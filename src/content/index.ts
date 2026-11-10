// Tutor registry. Server-only. Adding a tutor: a folder under tutors/ plus one line in TUTORS.
import { GEOGRAPHY } from "./tutors/geography/index.ts";
import type { TopicCard, Tutor } from "./types.ts";

export const TUTORS: readonly Tutor[] = [GEOGRAPHY];

export function tutorById(id: unknown): Tutor | undefined {
  return typeof id === "string" ? TUTORS.find((tutor) => tutor.id === id) : undefined;
}

/** Cards for a tutor. Approved only unless approvedOnly is explicitly false. */
export function cardsFor(tutorId: unknown, options: { approvedOnly?: boolean } = {}): TopicCard[] {
  const cards = tutorById(tutorId)?.cards ?? [];
  return options.approvedOnly === false ? [...cards] : cards.filter((c) => c.status === "approved");
}

/** Looks a card up across every tutor; ids are unique across tutors (lint-enforced). Includes drafts. */
export function cardById(id: unknown): TopicCard | undefined {
  if (typeof id !== "string") return undefined;
  for (const tutor of TUTORS) {
    const card = tutor.cards.find((c) => c.id === id);
    if (card) return card;
  }
  return undefined;
}

export type * from "./types.ts";
export { PEDAGOGY_VERSION, LIMITS } from "./core.ts";
