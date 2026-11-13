/**
 * Colour themes for the two tutors, shared by anything that shows a tutor's identity
 * (the in-call orb, picker cards, etc.).
 */
export type TutorKey = "river" | "matt";

export type TutorTheme = {
  name: string;
  /** Main accent colour, e.g. for borders and highlights. */
  accent: string;
  /** Lighter tint of the accent. */
  accentSoft: string;
  /** Darkest tone, used for centres and shadows. */
  deep: string;
};

export const TUTOR_THEME: Record<TutorKey, TutorTheme> = {
  river: {
    name: "Dr River",
    accent: "oklch(0.45 0.08 220)",
    accentSoft: "oklch(0.85 0.08 200)",
    deep: "oklch(0.25 0.04 240)",
  },
  matt: {
    name: "Prof Matt",
    accent: "oklch(0.55 0.12 50)",
    accentSoft: "oklch(0.82 0.12 75)",
    deep: "oklch(0.22 0.03 60)",
  },
};

/** Geography (no tutor id) is Dr River; "ppe" is Prof Matt. */
export function tutorKey(tutorId?: "ppe"): TutorKey {
  return tutorId === "ppe" ? "matt" : "river";
}
