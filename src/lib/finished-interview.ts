// The interview that has just ended, handed from the interview room to the feedback page and kept
// for this browser tab only (sessionStorage), so a refresh does not lose the transcript or letter.
// Browser-only UI state: the server still enforces one feedback per interview on its own.

export type FinishedLine = { role: "user" | "assistant"; text: string };

export type FinishedInterview = {
  interviewId: string;
  tutor: "ppe" | "geography";
  lines: FinishedLine[];
  cardIds?: string[];
  /** Set only if the tutor's chart was put on the table, so feedback can use its notes. */
  objectId?: string;
  /** True once feedback has been asked for, so a refresh does not ask twice. */
  feedbackRequested?: boolean;
  /** The finished letter (argument map block included), once it has arrived. */
  feedback?: string;
};

const KEY = "oxbridge.finishedInterview";

function isLine(value: unknown): value is FinishedLine {
  if (!value || typeof value !== "object") return false;
  const { role, text } = value as Record<string, unknown>;
  return (role === "user" || role === "assistant") && typeof text === "string";
}

/** Keeps only known, well-formed fields; anything else means there is no interview. */
export function parseFinishedInterview(value: unknown): FinishedInterview | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v["interviewId"] !== "string" || !v["interviewId"]) return null;
  if (v["tutor"] !== "ppe" && v["tutor"] !== "geography") return null;
  if (!Array.isArray(v["lines"]) || !v["lines"].every(isLine)) return null;
  const cardIds = Array.isArray(v["cardIds"])
    ? v["cardIds"].filter((id): id is string => typeof id === "string")
    : [];
  return {
    interviewId: v["interviewId"],
    tutor: v["tutor"],
    lines: (v["lines"] as FinishedLine[]).map(({ role, text }) => ({ role, text })),
    ...(cardIds.length ? { cardIds } : {}),
    ...(typeof v["objectId"] === "string" ? { objectId: v["objectId"] } : {}),
    ...(v["feedbackRequested"] === true ? { feedbackRequested: true } : {}),
    ...(typeof v["feedback"] === "string" ? { feedback: v["feedback"] } : {}),
  };
}

export function saveFinishedInterview(interview: FinishedInterview) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(interview));
  } catch {
    // Storage unavailable (private modes): the feedback page says there is nothing to show.
  }
}

export function loadFinishedInterview(): FinishedInterview | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? parseFinishedInterview(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Updates the stored interview, if it is still the same one. */
export function updateFinishedInterview(
  interviewId: string,
  changes: Pick<FinishedInterview, "feedbackRequested" | "feedback">,
) {
  const current = loadFinishedInterview();
  if (current?.interviewId === interviewId) saveFinishedInterview({ ...current, ...changes });
}

/** The transcript as the feedback request expects it. */
export function transcriptText(interview: Pick<FinishedInterview, "tutor" | "lines">): string {
  const tutorName = interview.tutor === "ppe" ? "Prof Matt" : "Dr River";
  return interview.lines
    .map((line) => `${line.role === "assistant" ? tutorName : "You"}: ${line.text.trim()}`)
    .join("\n\n");
}

/** Reverses `transcriptText`, for interviews kept on the account as text. */
export function linesFromTranscriptText(
  text: string,
  tutor: FinishedInterview["tutor"],
): FinishedLine[] {
  const tutorPrefix = `${tutor === "ppe" ? "Prof Matt" : "Dr River"}: `;
  const lines: FinishedLine[] = [];
  for (const block of text.split("\n\n")) {
    if (block.startsWith("You: ")) lines.push({ role: "user", text: block.slice(5) });
    else if (block.startsWith(tutorPrefix))
      lines.push({ role: "assistant", text: block.slice(tutorPrefix.length) });
    else if (lines.length) lines[lines.length - 1]!.text += `\n\n${block}`;
  }
  return lines;
}
