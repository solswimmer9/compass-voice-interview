import { describe, expect, it } from "vitest";

import { isTutorAvailable, tutorById } from "@/content";

describe("isTutorAvailable", () => {
  it("is true for a tutor with approved cards", () => {
    expect(isTutorAvailable("geography")).toBe(true);
  });

  it("is false for the PPE shell, which has no approved cards yet", () => {
    expect(tutorById("ppe")).toBeDefined();
    expect(isTutorAvailable("ppe")).toBe(false);
  });

  it("is false for unknown or non-string ids", () => {
    expect(isTutorAvailable("history")).toBe(false);
    expect(isTutorAvailable(undefined)).toBe(false);
    expect(isTutorAvailable(3)).toBe(false);
  });
});
