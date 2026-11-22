/**
 * Colour themes for the tutors, shared by anything that shows a tutor's identity
 * (the in-call orb, picker cards, etc.).
 */
// Dr Toby (Bio NatSci) has an orb ready; tutorKey() maps to him once his subject is live.
export type TutorKey = "river" | "matt" | "toby";

export type TutorTheme = {
  name: string;
  /** The tutor's colour: the orb's lines, portrait ring and status label. */
  colour: string;
  /** The same colour as "r g b", for translucent lines and glow. */
  rgb: string;
};

export const TUTOR_THEME: Record<TutorKey, TutorTheme> = {
  river: { name: "Dr River", colour: "#8ab4f0", rgb: "138 180 240" },
  matt: { name: "Prof Matt", colour: "#f2a65a", rgb: "242 166 90" },
  toby: { name: "Dr Toby", colour: "#7fd4a0", rgb: "127 212 160" },
};

/** Geography (no tutor id) is Dr River; "ppe" is Prof Matt. */
export function tutorKey(tutorId?: "ppe"): TutorKey {
  return tutorId === "ppe" ? "matt" : "river";
}
