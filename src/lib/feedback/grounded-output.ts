// Turns the evidence-checked pipeline's report into the plain Markdown the assessment panel
// already shows, and checks in code that every quotation in it is the student's own words.
// Returns null when the result is not good enough to show, so the caller can fall back.
import {
  ANALYST_FAILED_CAVEAT,
  WRITER_FAILED_CAVEAT,
  citedTurns,
  filterSentences,
  type GroundedFeedback,
} from "./pipeline";
import type { Turn } from "./types";
import { containsPhrase, normalise } from "./verify-quotes";

/** Fewest verified quotations a report must still show after checking. */
export const MIN_SHOWN_QUOTES = 2;

// Quotation constructs, consumed in this order (German and guillemet marks before plain curly
// ones, which share characters). Double marks may wrap onto the next line. Single marks stay
// on one line, and the closing mark must not be followed by a letter, so "don’t" is not a quote.
const QUOTE_PATTERNS: RegExp[] = [
  /„([^“”„]+)[“”]/g,
  /‚([^‘’‚\n]+)[‘’]/g,
  /«([^«»]+)»/g,
  /»([^«»]+)«/g,
  /‹([^‹›\n]+)›/g,
  /`+([^`]+)`+/g,
  /"([^"]+)"/g,
  /“([^“”]+)”/g,
  /(?<![\p{L}\p{N}])‘([^‘\n]+?)’(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])'([^'\n]+?)'(?![\p{L}\p{N}])/gu,
];

// Any quotation mark left once every pair has been consumed means quoting the checker cannot
// read. A straight single quote counts only where it opens a word ("'like"), so apostrophes in
// "don't" and "students' views" do not.
const STRAY_MARK = /["“”„«»‹›‘‚`]|(?<![\p{L}\p{N}])'(?=[\p{L}\p{N}])/u;

/** Markdown blockquote: text presented as quoted that the checker does not attribute. */
const BLOCKQUOTE = /^\s{0,3}>/m;

/**
 * Every quotation in a piece of text, and whether any quotation mark was left unpaired.
 * Understands straight and curly double and single marks, „German“ and ‚German‘ marks,
 * «guillemets» and `backticks`.
 */
export function scanQuotes(text: string): { quotes: string[]; unpaired: boolean } {
  if (typeof text !== "string") return { quotes: [], unpaired: false };
  const quotes: string[] = [];
  let rest = text;
  for (const re of QUOTE_PATTERNS) {
    rest = rest.replace(re, (whole: string, inner: string) => {
      quotes.push(inner ?? "");
      return " ".repeat(whole.length);
    });
  }
  return { quotes, unpaired: STRAY_MARK.test(rest) };
}

export function extractQuotes(text: string): string[] {
  return scanQuotes(text).quotes;
}

/**
 * True when the quotation appears word for word (after normalising) in one of the student's
 * turns. With `inTurns`, only those turns count.
 */
export function isStudentQuote(quote: string, turns: Turn[], inTurns?: number[]): boolean {
  const q = normalise(quote);
  if (!q) return true; // Only punctuation, e.g. "...": nothing to attribute.
  const allowed = inTurns?.length ? new Set(inTurns) : null;
  return turns.some(
    (t) =>
      t.role === "user" &&
      (!allowed || allowed.has(t.turn)) &&
      containsPhrase(normalise(t.text), q),
  );
}

/** Quotations in the text that are not the student's words (from any student turn). */
export function unverifiedQuotes(text: string, turns: Turn[]): string[] {
  return extractQuotes(text).filter((q) => !isStudentQuote(q, turns));
}

/**
 * True when a sentence must not be shown: it has a quotation mark the checker cannot pair, it
 * quotes words the student did not say, or it cites turns ([T4]) and a quotation is not in any
 * of them. A wrong turn reference drops the whole sentence rather than being silently removed.
 */
export function sentenceFailsCheck(sentence: string, turns: Turn[]): boolean {
  const { quotes, unpaired } = scanQuotes(sentence);
  if (unpaired) return true;
  const cited = citedTurns(sentence);
  return quotes.some((q) => !isStudentQuote(q, turns, cited));
}

/** Removes headings with no text under them. */
function dropEmptySections(markdown: string): string {
  const blocks: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  for (const line of markdown.split("\n")) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) blocks.push({ heading: line, lines: [] });
    else blocks[blocks.length - 1]!.lines.push(line);
  }
  return blocks
    .filter((b) => b.lines.some((l) => l.trim()))
    .map((b) => [b.heading, b.lines.join("\n").trim()].filter((s) => s !== null).join("\n"))
    .join("\n\n")
    .trim();
}

/** "[T7]" becomes "(turn 7)", "[T7, T9]" becomes "(turns 7 and 9)". */
export function readableCitations(text: string): string {
  return text.replace(/\[\s*(T\d+(?:\s*,\s*T\d+)*)\s*\]/g, (_, inner: string) => {
    const nums = inner.match(/\d+/g) ?? [];
    if (nums.length === 1) return `(turn ${nums[0]})`;
    return `(turns ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]})`;
  });
}

export type GroundedRender = { text: string } | { failure: string };

/**
 * Builds the panel's Markdown from a pipeline result. Sentences quoting words the student did
 * not say are removed; the result is refused (failure) if the pipeline did not really run, if too
 * little verified material is left, or if any quotation still fails the check.
 */
export function renderGroundedFeedback(result: GroundedFeedback, turns: Turn[]): GroundedRender {
  const { report } = result;
  if (report.caveats.includes(ANALYST_FAILED_CAVEAT)) return { failure: "analyst failed" };
  if (report.caveats.includes(WRITER_FAILED_CAVEAT)) return { failure: "writer failed" };
  if (report.observations.length < 2) return { failure: "too few verified observations" };

  const markdown = report.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
  // Fail closed on quoting the checker does not attribute.
  if (BLOCKQUOTE.test(markdown)) return { failure: "blockquote" };
  const filtered = filterSentences(markdown, (s) => sentenceFailsCheck(s, turns)).text;
  const text = dropEmptySections(filtered);

  // Check again on the whole text, so a quotation wrapping onto a second line is still read.
  const whole = scanQuotes(text);
  if (whole.unpaired) return { failure: "unpaired quotation mark" };
  if (whole.quotes.some((q) => !isStudentQuote(q, turns)))
    return { failure: "unverified quotation" };
  if (filterSentences(text, (s) => sentenceFailsCheck(s, turns)).removed)
    return { failure: "unverified quotation" };
  const quotes = whole.quotes.filter((q) => normalise(q));
  if (quotes.length < MIN_SHOWN_QUOTES) return { failure: "too few verified quotations" };
  if (!/^## /m.test(text)) return { failure: "no sections" };
  return { text: readableCitations(text) };
}
