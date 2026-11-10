export type SlopRule =
  | "generic-praise"
  | "generic-summary"
  | "filler"
  | "empty-superlative"
  | "score"
  | "admission-prediction"
  | "delivery-comment"
  | "character-label";

export type SlopMatch = { phrase: string; index: number; rule: SlopRule };

/** Generic feedback that could be written about any student. Matched as whole phrases, case-insensitively. */
export const GENERIC_PRAISE: string[] = [
  "great job",
  "good job",
  "well done",
  "excellent work",
  "keep up the good work",
  "keep up the great work",
  "showed great potential",
  "shows great potential",
  "showed real potential",
  "shows real potential",
  "strong communication skills",
  "excellent communication skills",
  "good communication skills",
  "impressive performance",
];

export const GENERIC_SUMMARY: string[] = [
  "overall, you demonstrated",
  "overall you demonstrated",
  "overall, you showed",
  "overall you showed",
  "overall, you displayed",
  "in conclusion, you",
  "all in all, you",
  "you demonstrated a strong",
  "you demonstrated a good",
];

export const FILLER: string[] = [
  "delve",
  "delves",
  "delving",
  "it's important to note",
  "it’s important to note",
  "it is important to note",
  "it is worth noting",
  "it's worth noting",
  "it’s worth noting",
  "a testament to",
  "rich tapestry",
  "navigate the complexities",
];

/** Superlatives with nothing attached to them. */
export const EMPTY_SUPERLATIVES: string[] = [
  "truly outstanding",
  "truly exceptional",
  "truly impressive",
  "absolutely brilliant",
  "absolutely fantastic",
  "simply superb",
  "exceptional answer",
  "outstanding answer",
  "outstanding performance",
  "fantastic answer",
  "brilliant answer",
  "amazing answer",
  "perfect answer",
  "second to none",
];

/** Banned by docs/interview-pedagogy.md: scores, rankings. Regular expressions, case-insensitive. */
export const SCORE_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*\/\s*10\b/gi,
  /\b(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+out\s+of\s+(?:10|ten)\b/gi,
  /\b(?:score|scored|rating|rated|grade|graded|mark|marked)\s+(?:of\s+|as\s+|at\s+)?\d+(?:\.\d+)?\b/gi,
  /\b(?:better|stronger|weaker|worse)\s+than\s+(?:most|other|many|the\s+average|average)\s+(?:students|candidates|applicants)\b/gi,
  /\b(?:top|bottom)\s+\d+\s*%/gi,
];

/** Banned: predictions about admission. */
export const ADMISSION_PATTERNS: RegExp[] = [
  /\byou(?:'ll|’ll|\s+will|\s+would)\s+(?:definitely\s+|certainly\s+|surely\s+|probably\s+)?(?:get|gain|secure|win)\s+(?:in|a\s+place|an\s+offer|into)\b/gi,
  /\b(?:likely|unlikely|certain|sure|bound)\s+to\s+(?:receive|get|be\s+offered|win|secure)\s+(?:an?\s+)?(?:offer|place|admission)\b/gi,
  /\b(?:likely|unlikely)\s+to\s+(?:be\s+)?(?:admitted|accepted|rejected|successful)\b/gi,
  /\byour\s+chances\s+(?:of|are|look)\b/gi,
  /\b(?:good|strong|poor|slim|real)\s+chance\s+of\s+(?:getting|an\s+offer|admission|success)\b/gi,
  /\byou(?:\s+are|['’]re)\s+(?:on\s+track|set)\s+(?:for|to\s+get)\s+(?:an?\s+)?(?:offer|oxford|cambridge|oxbridge)\b/gi,
  /\bwould\s+(?:impress|be\s+offered|get\s+an\s+offer)\b/gi,
];

/** Banned: accent, fluency, appearance, body language. Covers British and American spellings. */
export const DELIVERY_PATTERNS: RegExp[] = [
  /\b(?:your|an?|the|his|her|their)\s+(?:\w+\s+)?accent\b/gi,
  /\b(?:fluent|fluently|fluency|disfluen\w+|articulate(?:ly)?|eloquen\w+|well[- ]spoken)\b/gi,
  /\b(?:appearance|how\s+you\s+look(?:ed)?|looked\s+(?:smart|nervous|confident|relaxed|tired)|dress(?:ed)?\s+(?:well|smartly))\b/gi,
  /\b(?:body\s+language|eye\s+contact|posture|facial\s+expressions?|gestures?|fidget\w*|smil(?:e|ed|ing))\b/gi,
  /\b(?:composure|poise|demeanou?r)\b/gi,
  /\bpronunciation\b/gi,
];

/** Banned: labels about the person rather than the reasoning in this interview. */
export const CHARACTER_PATTERNS: RegExp[] = [
  /\byou\s+(?:clearly\s+|really\s+|seem\s+to\s+|appear\s+to\s+)?lack(?:ed)?\s+(?:confidence|self[- ]belief|ambition|intelligence|talent|drive|passion|maturity)\b/gi,
  /\byou(?:\s+(?:are|were)|['’]re)\s+(?:clearly\s+|obviously\s+|really\s+)?(?:a\s+)?(?:natural|born\s+\w+|naturally\s+\w+)\b/gi,
  /\byou(?:\s+(?:are|were)|['’]re)\s+(?:clearly\s+|obviously\s+|really\s+|very\s+|quite\s+|too\s+)?(?:shy|arrogant|lazy|nervous|insecure|timid|unconfident|not\s+confident|not\s+clever|not\s+bright|not\s+smart|intelligent|brilliant|clever|bright|gifted|talented)\b/gi,
  /\byou(?:\s+(?:are|were)|['’]re)\s+(?:the\s+type|a\s+(?:person|student|candidate|thinker)\s+who)\b/gi,
  /\b(?:lacks?|lacking)\s+(?:confidence|self[- ]belief|intellectual\s+curiosity)\b/gi,
  /\b(?:you\s+are|you're|you’re)\s+(?:an?\s+)?(?:\w+\s+)?(?:personality|character)\b/gi,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegExp(phrases: string[]): RegExp {
  const alts = phrases
    .map((p) => escapeRegExp(p).replace(/\s+/g, "\\s+").replace(/['’]/g, "['’]"))
    .sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

const PHRASE_RULES: [SlopRule, RegExp[]][] = [
  ["generic-praise", [phraseRegExp(GENERIC_PRAISE)]],
  ["generic-summary", [phraseRegExp(GENERIC_SUMMARY)]],
  ["filler", [phraseRegExp(FILLER)]],
  ["empty-superlative", [phraseRegExp(EMPTY_SUPERLATIVES)]],
  ["score", SCORE_PATTERNS],
  ["admission-prediction", ADMISSION_PATTERNS],
  ["delivery-comment", DELIVERY_PATTERNS],
  ["character-label", CHARACTER_PATTERNS],
];

/** Finds generic or banned feedback phrases. Results are sorted by position. Never throws. */
export function findSlop(text: string): SlopMatch[] {
  if (typeof text !== "string" || !text) return [];
  const out: SlopMatch[] = [];
  for (const [rule, patterns] of PHRASE_RULES) {
    for (const p of patterns) {
      const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`);
      for (const m of text.matchAll(re)) {
        out.push({ phrase: m[0], index: m.index ?? 0, rule });
      }
    }
  }
  // Drop a match that sits inside a longer match of the same rule.
  const deduped = out.filter(
    (m) =>
      !out.some(
        (o) =>
          o !== m &&
          o.rule === m.rule &&
          o.index <= m.index &&
          o.index + o.phrase.length >= m.index + m.phrase.length &&
          (o.phrase.length > m.phrase.length || (o.phrase.length === m.phrase.length && out.indexOf(o) < out.indexOf(m))),
      ),
  );
  return deduped.sort((a, b) => a.index - b.index);
}
