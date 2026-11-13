import { describe, expect, it } from "vitest";
import { CAPTION_MAX_WORDS, captionWords } from "@/lib/caption";

describe("live caption words", () => {
  it("keeps a short line whole, with stable word positions", () => {
    expect(captionWords("  So if one   vote ")).toEqual({
      words: [
        { index: 0, text: "So" },
        { index: 1, text: "if" },
        { index: 2, text: "one" },
        { index: 3, text: "vote" },
      ],
      trimmed: false,
    });
  });

  it("shows only the most recent words of a long line, keeping each word's position", () => {
    const text = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    const { words, trimmed } = captionWords(text);
    expect(trimmed).toBe(true);
    expect(words).toHaveLength(CAPTION_MAX_WORDS);
    expect(words[0]).toEqual({ index: 40 - CAPTION_MAX_WORDS, text: `w${40 - CAPTION_MAX_WORDS}` });
    expect(words.at(-1)).toEqual({ index: 39, text: "w39" });
  });

  it("gives a word the same key as the line grows", () => {
    const before = captionWords("Why should anyone").words.at(-1);
    const after = captionWords("Why should anyone bother turning up?").words[2];
    expect(after).toEqual(before);
  });

  it("returns nothing for an empty line", () => {
    expect(captionWords("   ")).toEqual({ words: [], trimmed: false });
  });
});
