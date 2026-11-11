// Browser-safe transcript helpers for the live interview replay.

export type TranscriptRole = "user" | "assistant";

export type TranscriptFragment = {
  text: string;
  start: number;
  end: number;
  sequence: number;
  /** Which voice session the fragment came from; bumps on every reconnect. */
  segment?: number;
};

export type TranscriptLine = {
  role: TranscriptRole;
  text: string;
  start: number;
  end: number;
  segment?: number;
  fragments: TranscriptFragment[];
};

/** Fragments within this many milliseconds of a line are treated as part of it. */
const MERGE_WINDOW_MS = 500;

/**
 * Adds a transcript delta to the replay. Deltas can arrive late or out of order, so a
 * fragment joins the most recent line of the same speaker whose time span it overlaps,
 * and is kept in time order inside it. Timings restart with each voice session, so lines
 * from an earlier session (segment) are never merged with later ones.
 */
export function appendTranscriptFragment(
  lines: TranscriptLine[],
  role: TranscriptRole,
  fragment: TranscriptFragment,
): TranscriptLine[] {
  const segment = fragment.segment ?? 0;
  const next = [...lines];
  let index = -1;
  for (let candidate = next.length - 1; candidate >= 0; candidate--) {
    const line = next[candidate]!;
    if ((line.segment ?? 0) !== segment) break;
    if (
      line.role === role &&
      fragment.start <= line.end + MERGE_WINDOW_MS &&
      fragment.end >= line.start - MERGE_WINDOW_MS
    ) {
      index = candidate;
      break;
    }
  }
  const last = next.at(-1);
  if (index < 0 && last?.role === role && (last.segment ?? 0) === segment) {
    index = next.length - 1;
  }
  if (index < 0) {
    return [
      ...next,
      {
        role,
        text: fragment.text,
        start: fragment.start,
        end: fragment.end,
        ...(fragment.segment === undefined ? {} : { segment }),
        fragments: [fragment],
      },
    ];
  }
  const line = next[index]!;
  const fragments = [...line.fragments, fragment].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.sequence - b.sequence,
  );
  next[index] = {
    ...line,
    start: Math.min(line.start, fragment.start),
    end: Math.max(line.end, fragment.end),
    fragments,
    text: fragments.map((part) => part.text).join(""),
  };
  return next;
}

function speaker(role: TranscriptRole, tutorName = "Dr River") {
  return role === "assistant" ? tutorName : "You";
}

/** The plain-text transcript used for feedback. */
export function formatTranscript(lines: TranscriptLine[], tutorName?: string) {
  return lines.map((line) => `${speaker(line.role, tutorName)}: ${line.text.trim()}`).join("\n\n");
}

/** Default size of the recap sent when reconnecting; the relay caps it again. */
export const RECAP_MAX_CHARS = 3000;

/**
 * A compact recap of the latest part of the conversation, for a reconnecting call.
 * Whitespace and control characters are flattened and whole lines are kept where possible.
 */
export function buildResumeRecap(
  lines: TranscriptLine[],
  maxChars = RECAP_MAX_CHARS,
  tutorName?: string,
) {
  if (maxChars <= 0) return "";
  const entries = lines
    .map((line) => ({
      role: line.role,
      text: line.text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\s]+/gu, " ").trim(),
    }))
    .filter((line) => line.text)
    .map((line) => `${speaker(line.role, tutorName)}: ${line.text}`);
  const kept: string[] = [];
  let size = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    const added = entry.length + (kept.length ? 1 : 0);
    if (size + added > maxChars) {
      // Keep the end of an over-long line rather than dropping the latest context.
      if (kept.length === 0) kept.unshift(`… ${entry.slice(-Math.max(0, maxChars - 2))}`);
      break;
    }
    kept.unshift(entry);
    size += added;
  }
  return kept.join("\n");
}

/** Names used elsewhere in the app for the same shapes. */
export type Fragment = TranscriptFragment;
export type Line = TranscriptLine;
