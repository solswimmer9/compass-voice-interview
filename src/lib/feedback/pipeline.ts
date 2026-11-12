import { z } from "zod";
import { parseTranscript } from "./transcript";
import type { FeedbackReport, Observation, Turn } from "./types";
import { findSlop } from "./slop";
import { tooThinToAssess, verifyObservations, type VerifiedObservation } from "./verify-quotes";

/** Bump when a prompt, schema or post-processing rule changes, so runs can be compared. */
export const FEEDBACK_PIPELINE_VERSION = "grounded-feedback-1";

export type Criterion = {
  id: string;
  name: string;
  evidenceLooksLike: string;
  notEvidence: string;
};

export type FeedbackInput = {
  transcript: string | Turn[];
  tutorName: string;
  criteria: Criterion[];
  reasoningGuide: string;
  /** Background for the analyst only (subject notes). Never evidence, never shown to the writer. */
  backendContext?: string;
  /** Turn numbers where speech recognition was unclear. */
  unclearTurns?: number[];
  interviewId?: string;
};

export type FeedbackDeps = {
  generateJSON(args: { system: string; prompt: string; schemaName: string }): Promise<unknown>;
  generateText(args: { system: string; prompt: string }): Promise<string>;
};

export type FeedbackStats = {
  proposed: number;
  verified: number;
  dropped: number;
  slopRetries: number;
  removedSentences: number;
};

export type GroundedFeedback = { report: FeedbackReport; stats: FeedbackStats };

// ---------------------------------------------------------------- schemas

export const evidenceSchema = z.object({
  turn: z.coerce.number().int(),
  quote: z.string(),
});

export const observationSchema = z.object({
  id: z.string().optional(),
  criterionId: z.string(),
  kind: z.enum(["strength", "improvement", "knowledge_gap"]),
  claim: z.string().min(1),
  evidence: z.array(evidenceSchema),
});

/** Name passed to generateJSON so the caller can attach a matching JSON schema. */
export const ANALYST_SCHEMA_NAME = "transcript_observations";

/** The analyst may return a bare array or { observations: [...] }. */
export function extractRawObservations(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { observations?: unknown }).observations)
  )
    return (raw as { observations: unknown[] }).observations;
  return [];
}

/** Keeps well-formed items, discards the rest. Never throws. */
export function parseObservations(raw: unknown): { observations: Observation[]; proposed: number } {
  const items = extractRawObservations(raw);
  const observations: Observation[] = [];
  for (const item of items) {
    const parsed = observationSchema.safeParse(item);
    if (!parsed.success) continue;
    const d = parsed.data;
    observations.push({
      id: d.id?.trim() || `o${observations.length + 1}`,
      criterionId: d.criterionId,
      kind: d.kind,
      claim: d.claim,
      evidence: d.evidence,
    });
  }
  return { observations, proposed: items.length };
}

// ---------------------------------------------------------------- prompts

export const ANALYST_SYSTEM = `You are a transcript analyst for a practice university interview. You do not write feedback. You propose candidate observations about the student's reasoning, each backed by exact quotations from the student's own turns. Another process checks every quote against the transcript and discards any that do not match. Reply with JSON only.`;

export const WRITER_SYSTEM = `You are an experienced admissions tutor writing feedback on a practice interview. You are given a list of verified observations, each with the exact words the student said. Write only from those observations. Do not add any claim, quotation or turn number that is not in the list. Use British English. Be specific and plain.`;

function renderTurn(t: Turn, unclear: Set<number>): string {
  const speaker = t.role === "user" ? "You" : "Tutor";
  const flag = t.unclear || unclear.has(t.turn) ? " [speech recognition unclear]" : "";
  return `[T${t.turn}] ${speaker}${flag}: ${t.text}`;
}

export function buildAnalystPrompt(
  input: Pick<FeedbackInput, "criteria" | "reasoningGuide" | "backendContext" | "unclearTurns">,
  turns: Turn[],
): string {
  const unclear = new Set(input.unclearTurns ?? []);
  const criteria = input.criteria
    .map(
      (c) =>
        `- id: ${c.id}\n  name: ${c.name}\n  evidence looks like: ${c.evidenceLooksLike}\n  does NOT count as evidence: ${c.notEvidence}`,
    )
    .join("\n");
  return [
    'Transcript (turns are numbered; "You" is the student, "Tutor" is the interviewer):',
    turns.map((t) => renderTurn(t, unclear)).join("\n"),
    "",
    "Criteria:",
    criteria || "(none supplied)",
    "",
    "How to judge:",
    input.reasoningGuide,
    input.backendContext
      ? `\nBackground notes (context only; never quote these and never treat them as evidence):\n${input.backendContext}`
      : "",
    "",
    "Task: propose candidate observations about the student's reasoning.",
    '- kind is "strength" (reasoning that worked), "improvement" (reasoning that slipped), or "knowledge_gap" (the student lacked a fact; this is not a weakness in thinking).',
    "- claim: one sentence about what the student did in this interview, not about their character.",
    '- evidence: one or more { turn, quote }. The quote must be copied exactly, word for word, from a student ("You") turn, at least four words, and the turn number must be that turn\'s number. Never quote the tutor. Never use a turn marked unclear for an improvement.',
    "- Skip anything you cannot support with an exact quotation. Fewer, well-supported observations are better than many.",
    "",
    `Reply with JSON only: an array of { "id": string, "criterionId": string, "kind": "strength" | "improvement" | "knowledge_gap", "claim": string, "evidence": [{ "turn": number, "quote": string }] }.`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

export const REPORT_HEADINGS = {
  overall: "Overall impression",
  strengths: "Strengths in reasoning",
  slipped: "Where the reasoning slipped",
  improvements: "Targeted improvements",
  reading: "Worth reading up on",
  next: "Try this next",
} as const;

function renderObservation(o: VerifiedObservation): string {
  const ev = o.evidence.map((e) => `    [T${e.turn}] "${e.quote}"`).join("\n");
  return `- (${o.criterionId}) ${o.claim}\n${ev}`;
}

export function buildWriterPrompt(
  input: Pick<FeedbackInput, "tutorName" | "reasoningGuide" | "criteria">,
  verified: VerifiedObservation[],
  caveats: string[] = [],
  slopToRemove: string[] = [],
): string {
  const names = new Map(input.criteria.map((c) => [c.id, c.name]));
  const group = (kind: Observation["kind"]) =>
    verified
      .filter((o) => o.kind === kind)
      .map((o) =>
        renderObservation({ ...o, criterionId: names.get(o.criterionId) ?? o.criterionId }),
      )
      .join("\n") || "(none)";
  const H = REPORT_HEADINGS;
  return [
    `Write feedback for the student on their practice interview with ${input.tutorName}. Speak to the student as "you". Markdown, British English, under 400 words.`,
    "",
    "Verified observations (the only material you may use):",
    "STRENGTHS",
    group("strength"),
    "IMPROVEMENTS",
    group("improvement"),
    "KNOWLEDGE GAPS (the student lacked a fact; these are not flaws in thinking)",
    group("knowledge_gap"),
    caveats.length ? `\nTranscript caveats: ${caveats.join(" ")}` : "",
    "",
    "Use exactly these headings, in this order, omitting a section only if it has nothing to draw on:",
    `## ${H.overall} (2-3 sentences, drawn from the observations)`,
    `## ${H.strengths} (one bullet per strength)`,
    `## ${H.slipped} (one bullet per improvement)`,
    `## ${H.improvements} (one concrete action per improvement; each improvement ends in something to do next time, phrased as an action)`,
    `## ${H.reading} (only if there are knowledge gaps: say what to read about. Never describe these as slips in reasoning.)`,
    `## ${H.next} (one follow-up question aimed at the single weakest assumption above, answerable by a 17-year-old)`,
    "",
    "Rules:",
    "- Every point cites its turn like [T7] and includes the student's words in quotation marks, copied from the list above.",
    "- Do not cite a turn or quote words that are not in the list. Do not add claims with no observation behind them.",
    "- Describe the reasoning in this interview, not the person. No labels about character.",
    "- No scores, no predictions about admission, no comparison with other students.",
    "- No comment on accent, fluency, appearance or body language.",
    "- Avoid generic praise and filler.",
    "",
    "Guide to judging reasoning (for tone and emphasis only):",
    input.reasoningGuide,
    slopToRemove.length
      ? `\nYour previous draft contained phrases that must not appear. Rewrite without them, or any wording like them: ${slopToRemove.map((p) => `"${p}"`).join(", ")}.`
      : "",
  ]
    .filter((s) => s !== "")
    .join("\n");
}

// ---------------------------------------------------------------- text checks

// Turn references in any of the forms a writer uses: [T7], [T 7], (T7), T7, [see T7], [T7, T9],
// (turn 7), [turn 7], turns 7 and 9, turns 4, 6 & 9.
const TURN_WORD_REF = /\bturns?\s+(\d+(?:\s*(?:,|and|&)\s*\d+)*)/gi;
const T_REF = /(?<![\p{L}\p{N}])T\s?(\d+)(?![\p{L}\p{N}])/gu;

/** Turn numbers cited in a piece of text, e.g. [T7], (turn 7) or "turns 7 and 9". */
export function citedTurns(text: string): number[] {
  if (typeof text !== "string") return [];
  const out: number[] = [];
  for (const m of text.matchAll(T_REF)) out.push(Number(m[1]));
  for (const m of text.matchAll(TURN_WORD_REF))
    for (const n of (m[1] ?? "").match(/\d+/g) ?? []) out.push(Number(n));
  return out;
}

/** Text with every turn reference removed. */
export function stripTurnReferences(text: string): string {
  return text.replace(TURN_WORD_REF, " ").replace(T_REF, " ");
}

const SENTENCE_BREAK = /(?<=[.!?]["”')\]]?)\s+(?=[A-Z[“"])/;

/** Applies `drop` to each sentence of each non-heading line. Returns new text and the count removed. */
export function filterSentences(
  text: string,
  drop: (sentence: string) => boolean,
): { text: string; removed: number } {
  let removed = 0;
  const lines = text.split("\n").map((line) => {
    if (/^\s*#/.test(line) || !line.trim()) return line;
    const prefix = /^(\s*(?:[-*]|\d+\.)\s+)/.exec(line)?.[1] ?? "";
    const body = line.slice(prefix.length);
    const kept = body.split(SENTENCE_BREAK).filter((s) => {
      if (drop(s)) {
        removed++;
        return false;
      }
      return true;
    });
    return kept.length ? prefix + kept.join(" ") : null;
  });
  return { text: lines.filter((l): l is string => l !== null).join("\n"), removed };
}

function slopPhrases(text: string): string[] {
  return [...new Set(findSlop(text).map((m) => m.phrase))];
}

function parseSections(text: string, verified: VerifiedObservation[]): FeedbackReport["sections"] {
  const sections: FeedbackReport["sections"] = [];
  let current: { heading: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    if (!body) return;
    const cited = new Set(citedTurns(body));
    const observationIds = verified
      .filter((o) => o.evidence.some((e) => cited.has(e.turn)))
      .map((o) => o.id);
    sections.push({ heading: current.heading, body, observationIds });
  };
  for (const line of text.split("\n")) {
    const m = /^#{1,6}\s+(.*?)\s*$/.exec(line);
    if (m) {
      flush();
      current = { heading: (m[1] ?? "").replace(/\s*\(.*\)\s*$/, ""), lines: [] };
    } else if (current) current.lines.push(line);
    else if (line.trim()) current = { heading: REPORT_HEADINGS.overall, lines: [line] };
  }
  flush();
  return sections;
}

function unclearCaveat(turns: Turn[], unclear: number[]): string[] {
  const nums = [
    ...new Set([...unclear, ...turns.filter((t) => t.unclear).map((t) => t.turn)]),
  ].sort((a, b) => a - b);
  if (!nums.length) return [];
  return [
    `Turn${nums.length > 1 ? "s" : ""} ${nums.join(", ")} ${nums.length > 1 ? "were" : "was"} unclear in the transcript and not used to criticise your reasoning.`,
  ];
}

/** Deterministic text used only if the writer fails outright. */
function fallbackText(verified: VerifiedObservation[]): string {
  const bullet = (o: VerifiedObservation) => {
    const e = o.evidence[0]!;
    return `- ${o.claim} [T${e.turn}] "${e.quote}"`;
  };
  const part = (heading: string, kind: Observation["kind"]) => {
    const items = verified.filter((o) => o.kind === kind);
    return items.length ? `## ${heading}\n${items.map(bullet).join("\n")}` : "";
  };
  return [
    part(REPORT_HEADINGS.strengths, "strength"),
    part(REPORT_HEADINGS.slipped, "improvement"),
    part(REPORT_HEADINGS.reading, "knowledge_gap"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------- pipeline

export const ANALYST_FAILED_CAVEAT = "The transcript analysis step failed.";
export const WRITER_FAILED_CAVEAT =
  "The written feedback could not be generated; the verified observations are listed instead.";

export async function runGroundedFeedback(
  input: FeedbackInput,
  deps: FeedbackDeps,
): Promise<GroundedFeedback> {
  const stats: FeedbackStats = {
    proposed: 0,
    verified: 0,
    dropped: 0,
    slopRetries: 0,
    removedSentences: 0,
  };
  const interviewId = input.interviewId ?? "";
  const unclear = input.unclearTurns ?? [];
  const baseTurns =
    typeof input.transcript === "string"
      ? parseTranscript(input.transcript, input.tutorName)
      : Array.isArray(input.transcript)
        ? input.transcript
        : [];
  const turns = baseTurns.map((t) => (unclear.includes(t.turn) ? { ...t, unclear: true } : t));
  const caveats = unclearCaveat(turns, unclear);
  const manifest = { pipelineVersion: FEEDBACK_PIPELINE_VERSION };

  // Stage 1: transcript analyst
  let raw: unknown = null;
  try {
    raw = await deps.generateJSON({
      system: ANALYST_SYSTEM,
      prompt: buildAnalystPrompt(input, turns),
      schemaName: ANALYST_SCHEMA_NAME,
    });
  } catch {
    caveats.push(ANALYST_FAILED_CAVEAT);
  }
  const { observations: candidates, proposed } = parseObservations(raw);
  stats.proposed = proposed;

  // Stage 2: verification in code
  const { verified } = verifyObservations(candidates, turns);
  stats.verified = verified.length;
  stats.dropped = Math.max(0, proposed - verified.length);

  if (tooThinToAssess(verified)) {
    return {
      stats,
      report: {
        interviewId,
        observations: verified,
        sections: [
          {
            heading: REPORT_HEADINGS.overall,
            body: "This interview was too short or too unclear to assess fairly. There was not enough of your own reasoning in the transcript to quote, so no judgement is given. Try a longer practice interview and speak in full sentences where you can.",
            observationIds: [],
          },
        ],
        nextQuestion: "",
        caveats,
        manifest,
      },
    };
  }

  // Stage 3: feedback writer (verified observations only)
  const safeWrite = async (prompt: string): Promise<string | null> => {
    try {
      const out = await deps.generateText({ system: WRITER_SYSTEM, prompt });
      return typeof out === "string" ? out : null;
    } catch {
      return null;
    }
  };
  let text = await safeWrite(buildWriterPrompt(input, verified, caveats));
  if (text === null) {
    caveats.push(WRITER_FAILED_CAVEAT);
    text = fallbackText(verified);
  }

  // Stage 4: slop check, one retry, then strip
  let slop = slopPhrases(text);
  if (slop.length) {
    stats.slopRetries++;
    const retry = await safeWrite(buildWriterPrompt(input, verified, caveats, slop));
    if (retry !== null) text = retry;
    slop = slopPhrases(text);
  }
  if (slop.length) {
    const r = filterSentences(text, (s) => findSlop(s).length > 0);
    text = r.text;
    stats.removedSentences += r.removed;
    caveats.push("Some generic or off-limits wording was removed from this feedback.");
  }

  // Stage 5: every cited turn must belong to a verified observation
  const allowed = new Set(verified.flatMap((o) => o.evidence.map((e) => e.turn)));
  const r5 = filterSentences(text, (s) => citedTurns(s).some((n) => !allowed.has(n)));
  text = r5.text;
  stats.removedSentences += r5.removed;
  if (r5.removed) caveats.push("Some points that did not match the transcript were removed.");

  const sections = parseSections(text, verified);
  const next = sections.find((s) =>
    s.heading.toLowerCase().startsWith(REPORT_HEADINGS.next.toLowerCase()),
  );
  return {
    stats,
    report: {
      interviewId,
      observations: verified,
      sections,
      nextQuestion: next?.body.replace(/\s*\[T\d+(?:\s*,\s*T\d+)*\]/g, "").trim() ?? "",
      caveats,
      manifest,
    },
  };
}
