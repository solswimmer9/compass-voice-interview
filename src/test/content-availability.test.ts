import { describe, expect, it } from "vitest";

import { isTutorAvailable, tutorById } from "@/content";

describe("isTutorAvailable", () => {
  it("is true for a tutor with approved cards", () => {
    expect(isTutorAvailable("geography")).toBe(true);
  });

  it("is true for PPE once it has approved cards (the relay still limits PPE to testers)", () => {
    expect(tutorById("ppe")).toBeDefined();
    expect(isTutorAvailable("ppe")).toBe(true);
  });

  it("is false for unknown or non-string ids", () => {
    expect(isTutorAvailable("history")).toBe(false);
    expect(isTutorAvailable(undefined)).toBe(false);
    expect(isTutorAvailable(3)).toBe(false);
  });
});
