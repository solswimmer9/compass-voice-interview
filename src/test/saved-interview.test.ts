import { describe, expect, it } from "vitest";
import { linesFromTranscriptText, transcriptText } from "@/lib/finished-interview";

describe("linesFromTranscriptText", () => {
  it("round-trips transcriptText, including a paragraph break inside a turn", () => {
    const lines = [
      { role: "assistant" as const, text: "Can a river be a person?" },
      { role: "user" as const, text: "Maybe.\n\nIn law, yes." },
    ];
    expect(
      linesFromTranscriptText(transcriptText({ tutor: "geography", lines }), "geography"),
    ).toEqual(lines);
    expect(linesFromTranscriptText(transcriptText({ tutor: "ppe", lines }), "ppe")).toEqual(lines);
  });
});
