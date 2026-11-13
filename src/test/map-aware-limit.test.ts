import { describe, expect, it } from "vitest";
import { ARGUMENT_MAP_DELIMITER, splitFeedbackStream } from "@/lib/feedback/argument-map";
import { createMapAwareLimiter, MAX_MAP_CHARS } from "@/lib/feedback/map-aware-limit";
import { createWordLimiter } from "@/lib/feedback/word-limit";

const MAP = '{"claim":"Caps help now","challenges":[{"text":"Who pays?","responses":[]}]}';

function run(chunks: string[], max?: number) {
  const limiter = createMapAwareLimiter(max);
  let out = "";
  for (const chunk of chunks) out += limiter.push(chunk);
  return out + limiter.end();
}

function chunked(text: string, size: number) {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

describe("map-aware word limit", () => {
  it("matches the plain word limiter when there is no map", () => {
    const text = "## Overall impression\nOne. Two words here. ".repeat(30);
    const plain = createWordLimiter(40);
    let expected = "";
    for (const part of chunked(text, 7)) expected += plain.push(part);
    expected += plain.end();
    expect(run(chunked(text, 7), 40)).toBe(expected);
  });

  it("keeps the map intact after a letter that runs over the limit, at any chunk size", () => {
    const letter = "This sentence has exactly six words. ".repeat(20);
    const full = `${letter}\n${ARGUMENT_MAP_DELIMITER}\n${MAP}`;
    for (const size of [1, 3, 5, 17, 1000]) {
      const out = run(chunked(full, size), 30);
      const split = splitFeedbackStream(out);
      expect(split.mapSource?.trim()).toBe(MAP);
      expect(split.letter.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(30);
    }
  });

  it("caps an oversized map block", () => {
    const out = run([`Short letter.\n${ARGUMENT_MAP_DELIMITER}`, "x".repeat(MAX_MAP_CHARS * 2)]);
    const after = out.slice(out.indexOf(ARGUMENT_MAP_DELIMITER));
    expect(after.length).toBe(MAX_MAP_CHARS);
  });

  it("releases a held-back partial delimiter that turns out to be ordinary text", () => {
    expect(run(["Compare a <<", "< b. Done."])).toBe("Compare a <<< b. Done.");
  });
});
