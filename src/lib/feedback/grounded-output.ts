// Turns the evidence-checked pipeline's report into the plain Markdown the assessment panel
// already shows, and checks in code that every quotation in it is the student's own words.
// Returns null when the result is not good enough to show, so the caller can fall back.
import {
  ANALYST_FAILED_CAVEAT,
  WRITER_FAILED_CAVEAT,
  filterSentences,
  type GroundedFeedback,
} from "./pipeline";
import type { Turn } from "./types";
import { containsPhrase, normalise } from "./verify-quotes";

/** Fewest verified quotations a report must still show after checking. */
export const MIN_SHOWN_QUOTES = 2;

const QUOTE_PATTERNS: RegExp[] = [
  /"([^"\n]+)"/g,
  /“([^”\n]+)”/g,
  // Single quotes: the closing mark must not be followed by a letter, so "don’t" is not a quote.
  /(?<![\p{L}\p{N}])‘(.+?)’(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])'(.+?)'(?![\p{L}\p{N}])/gu,
];

/** Every quotation in a piece of text, in double or single, straight or curly marks. */
export function extractQuotes(text: string): string[] {
  if (typeof text !== "string") return [];
  const out: string[] = [];
  for (const re of QUOTE_PATTERNS) for (const m of text.matchAll(re)) out.push(m[1] ?? "");
  return out;
}

/** True when the quotation appears word for word (after normalising) in one of the student's turns. */
export function isStudentQuote(quote: string, turns: Turn[]): boolean {
  const q = normalise(quote);
  if (!q) return true; // Only punctuation, e.g. "...": nothing to attribute.
  return turns.some((t) => t.role === "user" && containsPhrase(normalise(t.text), q));
}

export function unverifiedQuotes(text: string, turns: Turn[]): string[] {
  return extractQuotes(text).filter((q) => !isStudentQuote(q, turns));
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
  const filtered = filterSentences(markdown, (s) => unverifiedQuotes(s, turns).length > 0).text;
  const text = dropEmptySections(filtered);

  if (unverifiedQuotes(text, turns).length) return { failure: "unverified quotation" };
  const quotes = extractQuotes(text).filter((q) => normalise(q));
  if (quotes.length < MIN_SHOWN_QUOTES) return { failure: "too few verified quotations" };
  if (!/^## /m.test(text)) return { failure: "no sections" };
  return { text: readableCitations(text) };
}
