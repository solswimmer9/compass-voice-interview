import { describe, expect, it } from "vitest";

import { cardById, cardsFor, TUTORS, tutorById } from "@/content";

describe("content registry", () => {
  it("finds Dr River's tutor by id", () => {
    const tutor = tutorById("geography");
    expect(tutor?.persona.name).toBe("Dr River");
    expect(tutor?.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("returns undefined for unknown or non-string ids", () => {
    expect(tutorById("history")).toBeUndefined();
    expect(tutorById(undefined)).toBeUndefined();
    expect(tutorById(7)).toBeUndefined();
    expect(cardById("no-such-card")).toBeUndefined();
    expect(cardById(null)).toBeUndefined();
    expect(cardsFor("history")).toEqual([]);
  });

  it("returns only approved cards by default", () => {
    for (const tutor of TUTORS) {
      expect(cardsFor(tutor.id).every((card) => card.status === "approved")).toBe(true);
      expect(cardsFor(tutor.id, { approvedOnly: true })).toEqual(cardsFor(tutor.id));
      expect(cardsFor(tutor.id, { approvedOnly: false })).toEqual(tutor.cards);
    }
  });

  it("looks cards up by id across tutors", () => {
    const card = cardById("river-person");
    expect(card?.tutor).toBe("geography");
    expect(card?.opening).toBe("Can a river be a person?");
    for (const tutor of TUTORS) {
      for (const each of tutor.cards) expect(cardById(each.id)).toBe(each);
    }
  });
});
