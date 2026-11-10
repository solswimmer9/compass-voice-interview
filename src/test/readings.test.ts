import { describe, expect, it } from "vitest";
import { readingOpeningInstructions } from "@/lib/interview-briefing";
import { READINGS, readingById } from "@/lib/readings";

describe("practice readings", () => {
  it("only recognises known reading IDs", () => {
    expect(readingById("escobar-hippos")?.source).toBe("National Geographic");
    expect(readingById("made-up")).toBeUndefined();
    expect(readingById(42)).toBeUndefined();
  });

  it("keeps every reading's opening under the voice gateway's 480-byte cap", () => {
    for (const reading of READINGS) {
      const bytes = new TextEncoder().encode(readingOpeningInstructions(reading)).length;
      expect(bytes).toBeLessThanOrEqual(480);
    }
  });

  it("gives every reading a link, context and questions", () => {
    for (const reading of READINGS) {
      expect(reading.url).toMatch(/^https:\/\//);
      expect(reading.context.length).toBeGreaterThan(50);
      expect(reading.questions.length).toBeGreaterThanOrEqual(3);
    }
  });
});
