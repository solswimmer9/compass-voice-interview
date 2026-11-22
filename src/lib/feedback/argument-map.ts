import { z } from "zod";
import { subjectOrGeography } from "../subjects";

/**
 * The feedback stream is one streamText call: the tutor's written feedback, then (optionally)
 * this delimiter on its own line, then compact JSON describing the argument map. Shared by the
 * server prompt and the client parser so the two cannot drift.
 */
export const ARGUMENT_MAP_DELIMITER = "<<<ARGUMENT_MAP>>>";

/** Marker the server appends when the stream fails part-way. */
export const STREAM_ERROR_MARKER = "[[error]]";

export const MAX_CHALLENGES = 4;
export const MAX_RESPONSES = 3;
const MAX_TEXT = 220;

export const ARGUMENT_MAP_INSTRUCTIONS = `After the feedback, add a machine-readable argument map. Put ${ARGUMENT_MAP_DELIMITER} on its own line, then one line of compact JSON and nothing else:
{"claim":string,"challenges":[{"text":string,"responses":[{"text":string,"status":"held"|"unanswered"|"try_next_time"}]}]}
- claim: the candidate's main claim, in their own words where possible (under 25 words).
- challenges: at most ${MAX_CHALLENGES}, the main ways the interviewer pushed back or probed, each under 20 words.
- responses: at most ${MAX_RESPONSES} per challenge, how the candidate answered, each under 25 words. "held" if the answer stood up, "unanswered" if they did not address it, "try_next_time" if they answered but the reasoning slipped.
- Only use what is in the transcript; any quotation must be copied from it. Never invent a claim, challenge or answer. If there is no transcript, or no clear claim, put {"claim":"","challenges":[]}.
- Do not mention the argument map or the JSON in the feedback itself. No greeting or sign-off in the feedback: it is presented as a letter.`;

export const responseStatusSchema = z.enum(["held", "unanswered", "try_next_time"]);
export type ResponseStatus = z.infer<typeof responseStatusSchema>;

const text = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT))
  .pipe(z.string().min(1));

const status = z
  .string()
  .transform((s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_"),
  )
  .pipe(responseStatusSchema);

export const argumentMapSchema = z.object({
  claim: text,
  challenges: z
    .array(
      z.object({
        text,
        responses: z
          .array(z.object({ text, status }))
          .default([])
          .transform((r) => r.slice(0, MAX_RESPONSES)),
      }),
    )
    .transform((c) => c.slice(0, MAX_CHALLENGES))
    .refine((c) => c.length > 0),
});

export type ArgumentMap = z.output<typeof argumentMapSchema>;

export type SplitFeedback = {
  /** Text for the letter: never contains the delimiter, the JSON, or a partial delimiter. */
  letter: string;
  /** Raw text after the delimiter, or null if the delimiter has not arrived (yet). */
  mapSource: string | null;
  /** Error message appended by the server, if any. */
  error: string | null;
};

/**
 * Splits the (possibly partial) streamed text. Safe to call on every chunk: if the text ends
 * with the start of the delimiter (e.g. "<<<ARG"), that tail is held back from the letter.
 */
export function splitFeedbackStream(raw: string): SplitFeedback {
  const errorAt = raw.indexOf(STREAM_ERROR_MARKER);
  const body = errorAt === -1 ? raw : raw.slice(0, errorAt);
  const error = errorAt === -1 ? null : raw.slice(errorAt + STREAM_ERROR_MARKER.length).trim();

  const at = body.indexOf(ARGUMENT_MAP_DELIMITER);
  if (at !== -1)
    return {
      letter: body.slice(0, at).trimEnd(),
      mapSource: body.slice(at + ARGUMENT_MAP_DELIMITER.length),
      error,
    };

  let letter = body;
  for (let n = Math.min(ARGUMENT_MAP_DELIMITER.length - 1, body.length); n > 0; n--) {
    if (body.endsWith(ARGUMENT_MAP_DELIMITER.slice(0, n))) {
      letter = body.slice(0, -n);
      break;
    }
  }
  return { letter, mapSource: null, error };
}

/** Parses the text after the delimiter. Returns null for anything missing or malformed. */
export function parseArgumentMap(source: string | null | undefined): ArgumentMap | null {
  if (!source) return null;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = argumentMapSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export type LetterBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean };

const stripInline = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*\*/g, "")
    .trim();

/** Turns the Markdown feedback into simple blocks for the letter. Works on partial text too. */
export function letterBlocks(markdown: string): LetterBlock[] {
  const blocks: LetterBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let ordered = false;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
    if (list?.length) blocks.push({ kind: "list", items: list, ordered });
    list = null;
  };
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s*(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const text = stripInline(heading[1] ?? "");
      if (text) blocks.push({ kind: "heading", text });
      continue;
    }
    const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (paragraph.length) {
        blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
      }
      if (!list) {
        list = [];
        ordered = /\d/.test(bullet[1] ?? "");
      }
      list.push(stripInline(bullet[2] ?? ""));
      continue;
    }
    if (list) {
      // A continuation line of the previous bullet.
      if (list.length) list[list.length - 1] += ` ${stripInline(trimmed)}`;
      continue;
    }
    paragraph.push(stripInline(trimmed));
  }
  flush();
  return blocks;
}

export type TutorLetterInfo = { name: string; initials: string };

export function tutorLetterInfo(tutorId?: string): TutorLetterInfo {
  const { tutor, initials } = subjectOrGeography(tutorId);
  return { name: tutor, initials };
}

/** "Dear Sam," from a display name, or "Dear candidate,". */
export function letterSalutation(displayName?: string | null): string {
  const first = displayName
    ?.trim()
    .split(/\s+/)[0]
    ?.replace(/[^\p{L}\p{M}'’-]/gu, "");
  return `Dear ${first ? first : "candidate"},`;
}
