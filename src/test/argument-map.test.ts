import { describe, expect, it } from "vitest";
import {
  ARGUMENT_MAP_DELIMITER,
  letterBlocks,
  letterSalutation,
  parseArgumentMap,
  splitFeedbackStream,
  tutorLetterInfo,
} from "@/lib/feedback/argument-map";

const LETTER = "## Overall impression\nYou argued clearly that cities cluster near rivers.";
const MAP = {
  claim: "Cities grow where trade routes meet",
  challenges: [
    {
      text: "What about cities with no river?",
      responses: [
        { text: "Railways can do the same job", status: "held" },
        { text: "Did not address Las Vegas", status: "unanswered" },
      ],
    },
  ],
};

describe("splitFeedbackStream", () => {
  it("passes plain text through when there is no delimiter", () => {
    expect(splitFeedbackStream(LETTER)).toEqual({ letter: LETTER, mapSource: null, error: null });
  });

  it("holds back a partial delimiter mid-stream", () => {
    for (let n = 1; n < ARGUMENT_MAP_DELIMITER.length; n++) {
      const chunk = `${LETTER}\n${ARGUMENT_MAP_DELIMITER.slice(0, n)}`;
      const { letter, mapSource } = splitFeedbackStream(chunk);
      expect(letter).toBe(`${LETTER}\n`);
      expect(mapSource).toBeNull();
    }
  });

  it("hides the delimiter and partial JSON from the letter", () => {
    const partial = `${LETTER}\n${ARGUMENT_MAP_DELIMITER}\n{"claim":"Cities gr`;
    const { letter, mapSource } = splitFeedbackStream(partial);
    expect(letter).toBe(LETTER);
    expect(letter).not.toContain("<<<");
    expect(mapSource).toBe('\n{"claim":"Cities gr');
    expect(parseArgumentMap(mapSource)).toBeNull();
  });

  it("separates a server error from the letter and map", () => {
    const raw = `${LETTER}\n${ARGUMENT_MAP_DELIMITER}\n{"claim"\n\n[[error]]The assessment could not be completed.`;
    const split = splitFeedbackStream(raw);
    expect(split.letter).toBe(LETTER);
    expect(split.error).toBe("The assessment could not be completed.");
    expect(split.mapSource).not.toContain("[[error]]");
  });
});

describe("parseArgumentMap", () => {
  it("parses a valid block", () => {
    const { mapSource } = splitFeedbackStream(
      `${LETTER}\n${ARGUMENT_MAP_DELIMITER}\n${JSON.stringify(MAP)}\n`,
    );
    expect(parseArgumentMap(mapSource)).toEqual(MAP);
  });

  it("tolerates code fences and normalises status spelling", () => {
    const map = {
      ...MAP,
      challenges: [{ text: "Why?", responses: [{ text: "Because", status: "Try next time" }] }],
    };
    expect(parseArgumentMap("```json\n" + JSON.stringify(map) + "\n```")?.challenges[0]).toEqual({
      text: "Why?",
      responses: [{ text: "Because", status: "try_next_time" }],
    });
  });

  it("caps challenges and responses", () => {
    const response = { text: "r", status: "held" };
    const challenge = { text: "c", responses: Array(6).fill(response) };
    const parsed = parseArgumentMap(
      JSON.stringify({ claim: "x", challenges: Array(7).fill(challenge) }),
    );
    expect(parsed?.challenges).toHaveLength(4);
    expect(parsed?.challenges[0]?.responses).toHaveLength(3);
  });

  it("returns null for invalid JSON or shape", () => {
    expect(parseArgumentMap('{"claim": "x", challenges: [}')).toBeNull();
    expect(parseArgumentMap(JSON.stringify({ claim: "x", challenges: [] }))).toBeNull();
    expect(parseArgumentMap(JSON.stringify({ claim: "", challenges: MAP.challenges }))).toBeNull();
    expect(
      parseArgumentMap(
        JSON.stringify({
          claim: "x",
          challenges: [{ text: "y", responses: [{ text: "z", status: "maybe" }] }],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the block is missing", () => {
    expect(parseArgumentMap(splitFeedbackStream(LETTER).mapSource)).toBeNull();
    expect(parseArgumentMap("")).toBeNull();
    expect(parseArgumentMap(undefined)).toBeNull();
  });
});

describe("letter helpers", () => {
  it("turns Markdown into headings, paragraphs and lists", () => {
    expect(letterBlocks("## Strengths\n- **Clear** claim\n- Good scale\n\nWell done.")).toEqual([
      { kind: "heading", text: "Strengths" },
      { kind: "list", items: ["Clear claim", "Good scale"], ordered: false },
      { kind: "paragraph", text: "Well done." },
    ]);
    expect(letterBlocks("1. Define terms\n2. Name who loses")).toEqual([
      { kind: "list", items: ["Define terms", "Name who loses"], ordered: true },
    ]);
  });

  it("names the tutor and greets the student", () => {
    expect(tutorLetterInfo()).toEqual({ name: "Dr River", initials: "DR" });
    expect(tutorLetterInfo("ppe")).toEqual({ name: "Prof Matt", initials: "PM" });
    expect(letterSalutation("Amara Okafor")).toBe("Dear Amara,");
    expect(letterSalutation("  ")).toBe("Dear candidate,");
    expect(letterSalutation(null)).toBe("Dear candidate,");
  });
});
