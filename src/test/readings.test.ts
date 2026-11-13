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
      expect(reading.tutorThoughts.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("readings by subject", () => {
  it("offers Geography's readings on the Geography page only", async () => {
    const { readingsFor } = await import("@/lib/readings");
    const { SUBJECTS } = await import("@/lib/subjects");
    expect(readingsFor("geography").length).toBeGreaterThan(0);
    expect(readingsFor("ppe")).toEqual([]);
    for (const subject of SUBJECTS) {
      for (const reading of readingsFor(subject.id)) expect(reading.subject).toBe(subject.id);
    }
  });

  it("only finds a reading for its own subject when one is given", async () => {
    const { readingById } = await import("@/lib/readings");
    expect(readingById("escobar-hippos", "geography")?.id).toBe("escobar-hippos");
    expect(readingById("escobar-hippos", "ppe")).toBeUndefined();
  });
});
