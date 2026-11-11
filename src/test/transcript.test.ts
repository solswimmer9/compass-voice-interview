import { describe, expect, it } from "vitest";
import {
  appendTranscriptFragment,
  buildResumeRecap,
  formatTranscript,
  type TranscriptFragment,
  type TranscriptLine,
} from "@/lib/transcript";

let sequence = 0;
function fragment(text: string, start: number, end: number, segment?: number): TranscriptFragment {
  return { text, start, end, sequence: ++sequence, ...(segment === undefined ? {} : { segment }) };
}

function build(entries: Array<[TranscriptLine["role"], TranscriptFragment]>) {
  return entries.reduce<TranscriptLine[]>(
    (lines, [role, part]) => appendTranscriptFragment(lines, role, part),
    [],
  );
}

describe("appendTranscriptFragment", () => {
  it("joins consecutive fragments from the same speaker into one line", () => {
    const lines = build([
      ["assistant", fragment("Hello, ", 0, 400)],
      ["assistant", fragment("I'm Dr River.", 450, 1200)],
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ text: "Hello, I'm Dr River.", start: 0, end: 1200 });
  });

  it("starts a new line when the speaker changes", () => {
    const lines = build([
      ["assistant", fragment("Why rivers?", 0, 1000)],
      ["user", fragment("Because floods.", 1500, 2500)],
    ]);
    expect(lines.map((line) => line.role)).toEqual(["assistant", "user"]);
  });

  it("puts a late fragment back into time order inside its line", () => {
    const lines = build([
      ["user", fragment("world", 600, 1000)],
      ["user", fragment("hello ", 0, 500)],
    ]);
    expect(lines[0]?.text).toBe("hello world");
  });

  it("files a late fragment under the earlier line it overlaps", () => {
    const lines = build([
      ["user", fragment("I think ", 0, 800)],
      ["assistant", fragment("Go on.", 2000, 2600)],
      ["user", fragment("cities flood.", 700, 1500)],
    ]);
    expect(lines.map((line) => line.text)).toEqual(["I think cities flood.", "Go on."]);
  });

  it("does not mutate the existing lines", () => {
    const first = build([["user", fragment("Hi", 0, 100)]]);
    const snapshot = structuredClone(first);
    appendTranscriptFragment(first, "user", fragment(" there", 120, 300));
    expect(first).toEqual(snapshot);
  });

  it("keeps lines from a reconnected session separate even when timings overlap", () => {
    const lines = build([
      ["assistant", fragment("So, the delta.", 0, 2000, 0)],
      ["user", fragment("Deltas are", 2500, 4000, 0)],
      ["user", fragment("Sorry, as I was saying", 0, 1500, 1)],
    ]);
    expect(lines.map((line) => line.text)).toEqual([
      "So, the delta.",
      "Deltas are",
      "Sorry, as I was saying",
    ]);
    expect(lines[2]?.segment).toBe(1);
  });
});

describe("formatTranscript", () => {
  it("labels speakers for feedback", () => {
    const lines = build([
      ["assistant", fragment(" Why? ", 0, 100)],
      ["user", fragment("Because.", 500, 900)],
    ]);
    expect(formatTranscript(lines)).toBe("Dr River: Why?\n\nYou: Because.");
  });
});

describe("buildResumeRecap", () => {
  const lines = build([
    ["assistant", fragment("First question?", 0, 1000)],
    ["user", fragment("A long\n\tanswer\u0007 here.", 1500, 3000)],
    ["assistant", fragment("Latest challenge?", 3500, 4000)],
  ]);

  it("flattens whitespace and control characters into a compact recap", () => {
    expect(buildResumeRecap(lines)).toBe(
      "Dr River: First question?\nYou: A long answer here.\nDr River: Latest challenge?",
    );
  });

  it("keeps the latest whole lines that fit", () => {
    expect(buildResumeRecap(lines, 52)).toBe(
      "You: A long answer here.\nDr River: Latest challenge?",
    );
  });

  it("keeps the end of a single over-long line", () => {
    const recap = buildResumeRecap(lines, 12);
    expect(recap).toHaveLength(12);
    expect(recap.endsWith("challenge?")).toBe(true);
  });

  it("is empty when there is nothing to recap", () => {
    expect(buildResumeRecap([])).toBe("");
  });
});
