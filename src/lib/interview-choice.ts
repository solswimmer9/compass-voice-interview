// Which interview the student chose (subject, reading, object mode), kept in the page address
// and, across a sign-in that leaves the site (Google, email confirmation), in sessionStorage.
// Browser-only UI state: the server decides access and credits on its own.

export type InterviewChoice = { reading?: string; tutor?: "ppe" | "geography"; mode?: "object" };

/** Keeps only known values, so anything else in the address is ignored. */
export function parseInterviewChoice(search: Record<string, unknown>): InterviewChoice {
  const tutor = search["tutor"];
  return {
    ...(typeof search["reading"] === "string" ? { reading: search["reading"] } : {}),
    ...(tutor === "ppe" || tutor === "geography" ? { tutor } : {}),
    ...(search["mode"] === "object" ? { mode: "object" as const } : {}),
  };
}

/** True once a subject is known. Readings and object links without a tutor are geography. */
export function hasChosenSubject(choice: InterviewChoice): boolean {
  return Boolean(choice.tutor || choice.reading || choice.mode);
}

const KEY = "oxbridge.interviewChoice";

/** Called just before a sign-in that leaves the site. */
export function rememberChoiceForSignIn(choice: InterviewChoice) {
  try {
    if (hasChosenSubject(choice)) sessionStorage.setItem(KEY, JSON.stringify(choice));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private modes); the student just picks the subject again.
  }
}

/** Returns the remembered choice once, then forgets it. */
export function takeChoiceAfterSignIn(): InterviewChoice | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const choice = parseInterviewChoice(parsed as Record<string, unknown>);
    return hasChosenSubject(choice) ? choice : null;
  } catch {
    return null;
  }
}
