// Object interviews: the tutor "puts something on the table" (an unlabelled chart) and asks the
// student what it could be. Server-only.
//
// Access: students only ever get approved objects. Drafts are for tester accounts
// (PREVIEW_TESTER_EMAILS) only; the relay passes includeDrafts from authorizeStart's tester flag.
// Only `svg` and `alt` go to the browser (see objectForBrowser); the notes are tutor-only.
import { tutorById } from "../index.ts";
import type { InterviewObject, TutorId } from "../types.ts";
import ukTurnout from "./uk-turnout.ts";
import urbanRuralShare from "./urban-rural-share.ts";

export const OBJECTS: readonly InterviewObject[] = [urbanRuralShare, ukTurnout];

export type ObjectAccess = {
  /** Testers only. Students must never be given draft objects. */
  includeDrafts?: boolean;
};

function usable(object: InterviewObject, access: ObjectAccess) {
  return object.status === "approved" || access.includeDrafts === true;
}

/** Objects for a tutor. Approved only unless includeDrafts is true. */
export function objectsFor(tutorId: unknown, access: ObjectAccess = {}): InterviewObject[] {
  return OBJECTS.filter((object) => object.tutor === tutorId && usable(object, access));
}

/** Tutors with at least one approved object, so students may be offered an object interview. */
export function tutorsWithApprovedObjects(): TutorId[] {
  return [...new Set(OBJECTS.filter((o) => o.status === "approved").map((o) => o.tutor))];
}

/** Picks one usable object, rotating by seed. Undefined when there is none. */
export function selectObject(
  tutorId: unknown,
  access: ObjectAccess & { seed?: number } = {},
): InterviewObject | undefined {
  const list = objectsFor(tutorId, access);
  if (!list.length) return undefined;
  const seed = Number.isInteger(access.seed) ? Math.abs(access.seed ?? 0) : 0;
  return list[seed % list.length];
}

/** Looks an object up for feedback: only if usable under this access and for this tutor. */
export function usableObjectById(
  id: unknown,
  tutorId: TutorId,
  access: ObjectAccess = {},
): InterviewObject | undefined {
  return objectsFor(tutorId, access).find((object) => object.id === id);
}

/** The opening instruction for an object interview. Must fit LIMITS.openingBytes. */
export function objectOpening(object: InterviewObject): string {
  const persona = tutorById(object.tutor)?.persona;
  if (!persona) throw new Error(`Object ${object.id} has no tutor`);
  return `Start now in ${persona.language}. Briefly introduce yourself as ${persona.name}, running a practice ${persona.subject} interview. Say you have put something on the table for them to look at, then ask this in natural words and listen: ${object.notes.opening}`;
}

/** How the tutor handles the chart once it is on the table. Tutor-only. */
function objectNotesForTutor(object: InterviewObject): string {
  return `What it actually shows (tutor only): ${object.notes.shows}
Never say what it shows, and never confirm a guess outright, unless the student has reasoned their way there or it is the very end of the interview. When they guess, ask what makes them think so, and what would tell their guess apart from a rival one. If they are stuck, give one of the hints above, then hand the question back. Once they have it, push on what it means.
Follow-up probes, one at a time, chosen to follow their reasoning rather than in order:
${object.notes.probes.map((probe) => `- ${probe}`).join("\n")}
What good reasoning looks like: ${object.notes.goodReasoning}`;
}

/** Appended to the tutor's live instructions. Tutor-only: never send this to the browser. */
export function objectLiveSection(object: InterviewObject): string {
  return `OBJECT INTERVIEW
This interview opens with an object instead of your usual opening question. You have put an unlabelled chart on the table, and the student can see it on their screen. You cannot see it, so rely on this description. Spend roughly the first ten minutes on it, then move on to your other themes, linking back to it where you can.
You opened with: ${object.notes.opening}
${objectNotesForTutor(object)}`;
}

/**
 * Appended to the live instructions of a normal interview: the chart comes out partway through,
 * when the relay sends OBJECT_REVEAL_INSTRUCTION. Tutor-only: never send this to the browser.
 */
export function objectMidwaySection(object: InterviewObject): string {
  return `CHART LATER IN THE INTERVIEW
You will be told when to put an unlabelled chart on the table; do not mention it before then. When told, let the student finish their answer, then ask in natural words: ${object.notes.opening}
The student then sees it on screen; you cannot, so rely on this description. Spend about five minutes on it, then return to your themes.
${objectNotesForTutor(object)}`;
}

/** Sent mid-call to bring the chart out. Must fit LIMITS.openingBytes. */
export const OBJECT_REVEAL_INSTRUCTION =
  "It is now time for the chart, as described under CHART LATER IN THE INTERVIEW. Once the student finishes their current answer, say you would like to show them something, then ask your opening question about the chart and listen.";

/** Subject notes for feedback on an object interview. */
export function objectFeedbackContext(object: InterviewObject): string {
  return `OBJECT INTERVIEW NOTES
During this interview the student was shown an unlabelled chart the student had to interpret. Judge how they reasoned from its features, not whether they named it quickly.
What it showed: ${object.notes.shows}
What good reasoning looks like: ${object.notes.goodReasoning}`;
}

/** The only object fields the browser ever receives. */
export function objectForBrowser(object: InterviewObject, caption: string) {
  return {
    type: "app.interview.object" as const,
    objectId: object.id,
    svg: object.svg,
    alt: object.alt,
    caption,
  };
}
