import { describe, expect, it } from "vitest";

import { OPENING_QUESTIONS, openingInstructions } from "@/lib/interview-briefing";

describe("opening questions", () => {
  it("uses every question once before repeating", () => {
    const openings = OPENING_QUESTIONS.map((_, turn) => openingInstructions(turn + 7));
    expect(new Set(openings).size).toBe(OPENING_QUESTIONS.length);
    expect(openingInstructions(7 + OPENING_QUESTIONS.length)).toBe(openings[0]);
  });

  it("stays inside the voice service's 480-byte limit", () => {
    OPENING_QUESTIONS.forEach((_, turn) => {
      expect(new TextEncoder().encode(openingInstructions(turn)).length).toBeLessThanOrEqual(480);
    });
  });

  it("still picks a question if the browser sends no turn", () => {
    expect(openingInstructions(undefined)).toContain("opening question");
  });
});
