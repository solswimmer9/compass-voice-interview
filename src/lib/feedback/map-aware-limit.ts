// Word limit for feedback that may end with an argument-map block. Pure, no dependencies
// beyond the word limiter.
//
// The 400-word limit applies to the letter only. Once the map delimiter arrives the letter is
// closed (cut as createWordLimiter would cut it) and the map block passes through unchanged, up
// to MAX_MAP_CHARS, so a long letter can never cut the map off. Without a delimiter the output
// is exactly what createWordLimiter produces.
import { ARGUMENT_MAP_DELIMITER } from "./argument-map.ts";
import { createWordLimiter, FEEDBACK_WORD_LIMIT } from "./word-limit.ts";

/** A map at the instructed maximum (4 challenges x 3 responses) is about 4,500 characters. */
export const MAX_MAP_CHARS = 8000;

/** Length of the longest end of `text` that could be the start of the delimiter. */
function partialDelimiterLength(text: string): number {
  for (let k = Math.min(ARGUMENT_MAP_DELIMITER.length - 1, text.length); k > 0; k--) {
    if (ARGUMENT_MAP_DELIMITER.startsWith(text.slice(-k))) return k;
  }
  return 0;
}

export function createMapAwareLimiter(max: number = FEEDBACK_WORD_LIMIT) {
  const letter = createWordLimiter(max);
  let pending = "";
  let inMap = false;
  let mapChars = 0;
  const passMap = (text: string) => {
    const out = text.slice(0, Math.max(0, MAX_MAP_CHARS - mapChars));
    mapChars += out.length;
    return out;
  };
  return {
    /** True once nothing more will be sent, so the rest of the model's output can be ignored. */
    get done() {
      return inMap && mapChars >= MAX_MAP_CHARS;
    },
    push(delta: string): string {
      if (!delta) return "";
      if (inMap) return passMap(delta);
      pending += delta;
      const at = pending.indexOf(ARGUMENT_MAP_DELIMITER);
      if (at >= 0) {
        const before = pending.slice(0, at);
        const after = pending.slice(at);
        pending = "";
        inMap = true;
        return `${letter.push(before)}${letter.end()}\n${passMap(after)}`;
      }
      // Hold back anything that could be the first part of a delimiter split across chunks.
      const keep = partialDelimiterLength(pending);
      const ready = pending.slice(0, pending.length - keep);
      pending = pending.slice(pending.length - keep);
      return letter.push(ready);
    },
    end(): string {
      if (inMap) return "";
      const out = `${letter.push(pending)}${letter.end()}`;
      pending = "";
      return out;
    },
  };
}
