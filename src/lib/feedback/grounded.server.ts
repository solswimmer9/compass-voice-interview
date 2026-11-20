// Evidence-checked feedback for tester accounts. Server-only.
//
// The caller (assess.server.ts) has already applied every access rule before calling this, and
// supplies the model calls. Anything short of a fully checked report returns null, and the
// caller then gives today's feedback instead, with no error shown.
import { NOTES_CONTEXT, REASONING_GUIDE } from "../interview-briefing.ts";
import { ppeFeedbackContext, ppeTutor } from "../ppe.server.ts";
import { GEOGRAPHY_CRITERIA, PPE_CRITERIA } from "./criteria";
import { renderGroundedFeedback } from "./grounded-output";
import { runGroundedFeedback, type FeedbackDeps, type FeedbackInput } from "./pipeline";
import { parseTranscript } from "./transcript";
import { limitWords } from "./word-limit";

/** Whole-pipeline budget (analyst, writer and at most one rewrite). */
export const GROUNDED_TIMEOUT_MS = 60_000;
/** The pipeline needs at least this many student turns to have anything to quote. */
export const MIN_STUDENT_TURNS = 2;

export type GroundedRequest = {
  transcript: string;
  ppe: boolean;
  cardIds?: unknown;
  interviewId?: string;
};

export type GroundedOutcome =
  { ok: true; text: string; truncated: boolean } | { ok: false; reason: string };

function tutorName(ppe: boolean): string {
  return ppe ? ppeTutor().persona.name : "Dr River";
}

/** Cheap check, before any model call, that a transcript can go through the pipeline at all. */
export function canUseGroundedFeedback(args: {
  transcript: string;
  video: string;
  ppe: boolean;
}): boolean {
  // A video (with or without a transcript) is assessed on today's path: the pipeline only reads
  // the transcript, cannot check anything said in a video, and deliberately avoids comments on
  // delivery that a video submission asks for.
  if (args.video || !args.transcript) return false;
  const turns = parseTranscript(args.transcript, tutorName(args.ppe));
  return turns.filter((t) => t.role === "user").length >= MIN_STUDENT_TURNS;
}

/**
 * Tester-only subject inputs. Testers may draw on draft PPE notes, as on today's tester path.
 *
 * This hard-codes `includeDrafts: true`, so it must only be reached for a server-verified tester:
 * `handleAssess` calls it only when `preview` (from `isServerTester`) is true. Never call it
 * from a path a student can reach. `src/test/grounded-gate.test.ts` guards both halves.
 */
export function groundedInput(req: GroundedRequest): FeedbackInput {
  if (req.ppe) {
    const tutor = ppeTutor();
    return {
      transcript: req.transcript,
      tutorName: tutor.persona.name,
      criteria: PPE_CRITERIA,
      reasoningGuide: tutor.reasoningGuide,
      backendContext: ppeFeedbackContext(req.cardIds, { includeDrafts: true }),
      ...(req.interviewId ? { interviewId: req.interviewId } : {}),
    };
  }
  return {
    transcript: req.transcript,
    tutorName: "Dr River",
    criteria: GEOGRAPHY_CRITERIA,
    reasoningGuide: REASONING_GUIDE,
    backendContext: NOTES_CONTEXT,
    ...(req.interviewId ? { interviewId: req.interviewId } : {}),
  };
}

/**
 * Runs the pipeline within `timeoutMs` and returns checked Markdown within the word limit, or a
 * reason for falling back. Never throws. `abort` is called on timeout so in-flight model calls
 * can be cancelled.
 */
export async function runTesterFeedback(
  req: GroundedRequest,
  deps: FeedbackDeps,
  options: { timeoutMs?: number; abort?: () => void } = {},
): Promise<GroundedOutcome> {
  const timeoutMs = options.timeoutMs ?? GROUNDED_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const input = groundedInput(req);
    const turns = parseTranscript(req.transcript, input.tutorName);
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([runGroundedFeedback(input, deps), timeout]);
    if (result === "timeout") {
      options.abort?.();
      return { ok: false, reason: "timeout" };
    }
    const rendered = renderGroundedFeedback(result, turns);
    if ("failure" in rendered) return { ok: false, reason: rendered.failure };
    const limited = limitWords(rendered.text);
    return { ok: true, text: limited.text, truncated: limited.truncated };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reads the analyst's JSON reply, tolerating Markdown code fences or a sentence around it.
 * Returns null when nothing parses; the pipeline treats that as no observations.
 */
export function parseModelJson(text: unknown): unknown {
  if (typeof text !== "string") return null;
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through
  }
  for (const [open, close] of [
    ["[", "]"],
    ["{", "}"],
  ] as const) {
    const start = unfenced.indexOf(open);
    const end = unfenced.lastIndexOf(close);
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      // try the next shape
    }
  }
  return null;
}
