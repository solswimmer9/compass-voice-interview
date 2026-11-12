// Enforces the "under 400 words" feedback limit in code. Pure, no dependencies.
//
// Text is cut only at the end of a sentence or a line, never inside a heading, and a heading
// left with nothing under it is dropped. Text within the limit is returned unchanged.

export const FEEDBACK_WORD_LIMIT = 400;

type Unit = { kind: "heading" | "text"; end: number; words: number };

const HEADING = /^\s{0,3}#{1,6}\s/;
// A line that is only bold text ("**Strengths**", "__Try this next:__") reads as a heading.
const BOLD_HEADING = /^\s*(\*\*|__)[^*_\n]+\1\s*:?\s*$/;
const STARTS_BOLD = /^\s*(\*\*|__)/;
// Words whose full stop is not the end of a sentence. Lower-case, without the final stop.
const ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "st",
  "sr",
  "jr",
  "e.g",
  "i.e",
  "etc",
  "vs",
  "cf",
  "no",
  "fig",
  "approx",
  "ca",
  "c",
  "p",
  "pp",
  "vol",
  "ch",
  "ed",
  "eds",
  "op",
  "al",
]);

function isAbbreviation(before: string): boolean {
  const token = /([\p{L}.]+)$/u.exec(before)?.[1];
  if (!token) return false;
  // Single capital initial, as in "J. Smith".
  if (/^\p{Lu}$/u.test(token)) return true;
  return ABBREVIATIONS.has(token.toLowerCase().replace(/^\.+/, ""));
}
// End of a sentence: punctuation, optional closing quotes or brackets, then whitespace and
// something that starts a new sentence. Only boundaries whose next character is already
// present are found, so the split never changes as more streamed text arrives.
const SENTENCE_END = /[.!?…]+["”’')\]]*(?=\s+["“‘'([*_]*[\p{Lu}\p{N}])/gu;

/** Words a reader sees: whitespace-separated tokens with a letter or digit ("##", "-" do not count). */
export function countWords(text: string): number {
  if (typeof text !== "string") return 0;
  let n = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++;
  return n;
}

/** Splits text into heading lines and sentences, with end offsets. Blank lines are not units. */
function segment(text: string, final: boolean): Unit[] {
  const units: Unit[] = [];
  let start = 0;
  while (start <= text.length) {
    const nl = text.indexOf("\n", start);
    const complete = nl !== -1 || final;
    const lineEnd = nl === -1 ? text.length : nl;
    const line = text.slice(start, lineEnd);
    if (line.trim()) {
      if (HEADING.test(line) || (complete && BOLD_HEADING.test(line))) {
        if (complete) units.push({ kind: "heading", end: lineEnd, words: countWords(line) });
      } else if (!complete && STARTS_BOLD.test(line)) {
        // May turn out to be a bold heading: wait for the whole line, so the split never changes.
      } else {
        let from = 0;
        for (const m of line.matchAll(SENTENCE_END)) {
          // "Dr." and "e.g." do not end a sentence. Only the full stop itself is checked; "!" or
          // "?" after an abbreviation still ends one.
          if (m[0].startsWith(".") && isAbbreviation(line.slice(0, m.index ?? 0))) continue;
          const end = (m.index ?? 0) + m[0].length;
          units.push({ kind: "text", end: start + end, words: countWords(line.slice(from, end)) });
          from = end;
        }
        if (complete && line.slice(from).trim())
          units.push({ kind: "text", end: lineEnd, words: countWords(line.slice(from)) });
      }
    }
    if (nl === -1) break;
    start = nl + 1;
  }
  return units;
}

/** End offset of the longest run of whole units within `max` words, never ending on a heading. */
function fit(units: Unit[], max: number): { end: number; over: boolean; anyText: boolean } {
  let total = 0;
  let end = 0;
  let anyText = false;
  for (const u of units) {
    if (total + u.words > max) return { end, over: true, anyText };
    total += u.words;
    if (u.kind === "text") {
      end = u.end;
      anyText = true;
    }
  }
  return { end, over: false, anyText };
}

/** Offset just after the `max`-th counted word. */
function wordCutOffset(text: string, max: number): number {
  let n = 0;
  for (const m of text.matchAll(/\S+/g)) {
    if (!/[\p{L}\p{N}]/u.test(m[0])) continue;
    if (++n === max) return (m.index ?? 0) + m[0].length;
  }
  return text.length;
}

/**
 * Shortens Markdown feedback to at most `max` words at a sentence or line boundary.
 * Returns the text unchanged when it is within the limit. Never cuts a heading in half and
 * never ends on a heading with no text under it. If not even one sentence fits (one enormous
 * sentence), cuts at a word boundary and adds an ellipsis.
 */
export function limitWords(
  text: string,
  max: number = FEEDBACK_WORD_LIMIT,
): { text: string; truncated: boolean } {
  if (typeof text !== "string") return { text: "", truncated: false };
  if (countWords(text) <= max) return { text, truncated: false };
  const { end, anyText } = fit(segment(text, true), max);
  if (anyText) return { text: text.slice(0, end), truncated: true };
  return { text: `${text.slice(0, wordCutOffset(text, max)).trimEnd()}…`, truncated: true };
}

/**
 * Streaming form of limitWords. `push` returns the text that is safe to send now (whole
 * sentences or lines, never a trailing heading); `end` returns the rest. Everything sent, joined,
 * equals limitWords(fullText).text. Once `done` is true the rest of the model's output can be
 * ignored.
 */
export function createWordLimiter(max: number = FEEDBACK_WORD_LIMIT) {
  let buffer = "";
  let emitted = 0;
  let done = false;
  const finish = () => {
    done = true;
    const out = limitWords(buffer, max).text;
    const rest = out.slice(emitted);
    emitted = out.length;
    return rest;
  };
  return {
    get done() {
      return done;
    },
    push(delta: string): string {
      if (done || !delta) return "";
      buffer += delta;
      const { end, over } = fit(segment(buffer, false), max);
      if (over) return finish();
      if (end <= emitted) return "";
      const out = buffer.slice(emitted, end);
      emitted = end;
      return out;
    },
    end(): string {
      return done ? "" : finish();
    },
  };
}
