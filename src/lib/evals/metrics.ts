import type { Turn } from "@/lib/feedback/types";

/** One transcript delta as the live relay produces it (see `Transcript` in live-relay.server.ts). */
export type TranscriptDelta = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
};

/** A merged turn. Extends the feedback `Turn` so parsers and the judge share one shape. */
export type TimedTurn = Turn & { start_ms: number; end_ms: number };

/** Role "assistant" is the tutor, "user" is the student. */
const isTutor = (t: Pick<Turn, "role">) => t.role === "assistant";

const words = (s: string): string[] => s.match(/[\p{L}\p{N}'’-]+/gu) ?? [];

/**
 * Merges consecutive same-role deltas into turns. Start is the first delta's start,
 * end the last delta's end (max, in case of out-of-order timings). Empty text deltas
 * are skipped. Turns are numbered from 1. Never throws.
 */
export function groupTurns(deltas: readonly TranscriptDelta[]): TimedTurn[] {
  const turns: TimedTurn[] = [];
  for (const d of Array.isArray(deltas) ? deltas : []) {
    if (!d || typeof d.text !== "string" || !d.text.trim()) continue;
    const text = d.text.replace(/\s+/g, " ").trim();
    const start = Number.isFinite(d.start_ms) ? d.start_ms : 0;
    const end = Number.isFinite(d.end_ms) ? Math.max(d.end_ms, start) : start;
    const last = turns[turns.length - 1];
    if (last && last.role === d.role) {
      last.text = `${last.text} ${text}`;
      last.start_ms = Math.min(last.start_ms, start);
      last.end_ms = Math.max(last.end_ms, end);
    } else {
      turns.push({ turn: turns.length + 1, role: d.role, text, start_ms: start, end_ms: end });
    }
  }
  return turns;
}

/** Counts sentences by terminal punctuation; unpunctuated text counts as one. */
export function countSentences(text: string): number {
  const parts = text.split(/[.!?]+(?:\s+|$)/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return parts.length;
}

const countQuestions = (text: string): number => (text.match(/\?/g) ?? []).length;

/**
 * Patterns that suggest a leading question (the student could answer with just "yes").
 * HEURISTIC: regexes over text, so they miss leading questions phrased differently and
 * can flag innocent uses. Treat the rate as a trend signal, not a verdict.
 */
export const LEADING_PATTERNS: readonly { id: string; re: RegExp }[] = [
  { id: "wouldnt-you-say", re: /\bwouldn['’]?t you say\b/i },
  {
    id: "isnt-it",
    re: /\b(isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t) (it|that|this|they|he|she|there)\b/i,
  },
  { id: "dont-you-think", re: /\bdon['’]?t you (think|agree|see|feel)\b/i },
  { id: "so-you-agree", re: /\bso you (agree|accept|would agree|admit)\b/i },
  { id: "surely", re: /\bsurely\b/i },
  {
    id: "wouldnt-it",
    re: /\b(wouldn['’]?t|won['’]?t|doesn['’]?t|didn['’]?t|couldn['’]?t|shouldn['’]?t) (it|that|they|this)\b/i,
  },
  {
    id: "tag-question",
    re: /,\s*(isn['’]?t it|aren['’]?t they|doesn['’]?t it|don['’]?t they|wouldn['’]?t it|right|correct|yes|no|true|innit)\s*\?/i,
  },
];

export function findLeadingPatterns(text: string): string[] {
  return LEADING_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}

/** Common words of 5+ letters that carry no reference to the student's content. */
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "about above after again against agree because before being below between could " +
    "doing during every first going great maybe might never other quite rather really " +
    "right shall should since still sure their there these thing things think those " +
    "though through under until using want where which while would yeah yours " +
    "actually exactly interesting something someone anything everything"
  ).split(/\s+/),
);

function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of words(text.toLowerCase())) {
    const clean = w.replace(/^['’-]+|['’-]+$/g, "");
    if (clean.length >= 5 && !STOPWORDS.has(clean)) out.add(clean);
  }
  return out;
}

/**
 * HEURISTIC: a tutor turn "refers to the student's previous answer" if it shares at
 * least one content word (5+ letters, not a stopword) with the preceding student turn.
 * It over-counts when the tutor's own earlier question used the same word and the
 * student echoed it, and under-counts paraphrase ("the bend" for "meander"). Plurals
 * are not stemmed beyond a trailing "s".
 */
export function refersToPrevious(tutorText: string, studentText: string): boolean {
  const stem = (w: string) => (w.length > 5 && w.endsWith("s") ? w.slice(0, -1) : w);
  const student = new Set([...contentWords(studentText)].map(stem));
  for (const w of contentWords(tutorText)) if (student.has(stem(w))) return true;
  return false;
}

export type InterviewMetrics = {
  turnCount: number;
  tutorTurnCount: number;
  studentTurnCount: number;
  durationMs: number;
  tutorWords: number;
  studentWords: number;
  /** Tutor words / all words. 0 when there are no words. */
  tutorTalkShare: number;
  longTutorTurns: number;
  longTutorTurnShare: number;
  multiQuestionTutorTurns: number;
  multiQuestionShare: number;
  /** Tutor turns that follow a student turn (the opening turn is excluded). */
  tutorTurnsWithPrecedingStudent: number;
  referringTutorTurns: number;
  referenceShare: number;
  leadingCandidates: number;
  leadingShare: number;
  /** Turn numbers of leading candidates, for a human to check. */
  leadingTurns: number[];
  interruptions: number;
  /** Null when there is no student-to-tutor handover to time. */
  gapMedianMs: number | null;
  gapP90Ms: number | null;
};

const share = (n: number, d: number) => (d > 0 ? n / d : 0);

/** Linear-interpolated percentile of a sorted array. */
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Pure; never throws and never divides by zero (shares are 0 and gaps null when undefined). */
export function interviewMetrics(turns: readonly TimedTurn[]): InterviewMetrics {
  const list = Array.isArray(turns) ? turns : [];
  let tutorWords = 0;
  let studentWords = 0;
  let tutorTurnCount = 0;
  let longTutorTurns = 0;
  let multiQuestionTutorTurns = 0;
  let withPreceding = 0;
  let referring = 0;
  const leadingTurns: number[] = [];
  let interruptions = 0;
  const gaps: number[] = [];

  list.forEach((t, i) => {
    const n = words(t.text).length;
    if (!isTutor(t)) {
      studentWords += n;
      return;
    }
    tutorWords += n;
    tutorTurnCount++;
    if (countSentences(t.text) > 3) longTutorTurns++;
    if (countQuestions(t.text) > 1) multiQuestionTutorTurns++;
    if (findLeadingPatterns(t.text).length > 0) leadingTurns.push(t.turn);
    const prev = list[i - 1];
    if (prev && !isTutor(prev)) {
      withPreceding++;
      if (refersToPrevious(t.text, prev.text)) referring++;
      if (t.start_ms < prev.end_ms) interruptions++;
      else gaps.push(t.start_ms - prev.end_ms);
    }
  });

  gaps.sort((a, b) => a - b);
  const starts = list.map((t) => t.start_ms);
  const ends = list.map((t) => t.end_ms);
  return {
    turnCount: list.length,
    tutorTurnCount,
    studentTurnCount: list.length - tutorTurnCount,
    durationMs: list.length ? Math.max(...ends) - Math.min(...starts) : 0,
    tutorWords,
    studentWords,
    tutorTalkShare: share(tutorWords, tutorWords + studentWords),
    longTutorTurns,
    longTutorTurnShare: share(longTutorTurns, tutorTurnCount),
    multiQuestionTutorTurns,
    multiQuestionShare: share(multiQuestionTutorTurns, tutorTurnCount),
    tutorTurnsWithPrecedingStudent: withPreceding,
    referringTutorTurns: referring,
    referenceShare: share(referring, withPreceding),
    leadingCandidates: leadingTurns.length,
    leadingShare: share(leadingTurns.length, tutorTurnCount),
    leadingTurns,
    interruptions,
    gapMedianMs: percentile(gaps, 0.5),
    gapP90Ms: percentile(gaps, 0.9),
  };
}

export type ShareMeasure =
  "leadingShare" | "longTutorTurnShare" | "referenceShare" | "tutorTalkShare";

export type Thresholds = {
  /** Architecture section 12: block if over 5%. */
  leadingShareMax: number;
  /** Section 12: block if over 10%. */
  longTutorTurnShareMax: number;
  /** Section 12: block if under 70%. */
  referenceShareMin: number;
  /** Section 14: target under 40%. */
  tutorTalkShareMax: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  leadingShareMax: 0.05,
  longTutorTurnShareMax: 0.1,
  referenceShareMin: 0.7,
  tutorTalkShareMax: 0.4,
};

export type ThresholdResult = {
  measure: ShareMeasure;
  value: number;
  limit: number;
  direction: "max" | "min";
  /** Null when the measure cannot be computed (no tutor turns, or none after a student turn). */
  pass: boolean | null;
};

export type ThresholdReport = { results: ThresholdResult[]; passed: boolean };

/** `passed` is false if any measurable result fails; unmeasurable results do not fail. */
export function checkThresholds(
  m: InterviewMetrics,
  t: Thresholds = DEFAULT_THRESHOLDS,
): ThresholdReport {
  const hasTutor = m.tutorTurnCount > 0;
  const hasWords = m.tutorWords + m.studentWords > 0;
  const results: ThresholdResult[] = [
    {
      measure: "leadingShare",
      value: m.leadingShare,
      limit: t.leadingShareMax,
      direction: "max",
      pass: hasTutor ? m.leadingShare <= t.leadingShareMax : null,
    },
    {
      measure: "longTutorTurnShare",
      value: m.longTutorTurnShare,
      limit: t.longTutorTurnShareMax,
      direction: "max",
      pass: hasTutor ? m.longTutorTurnShare <= t.longTutorTurnShareMax : null,
    },
    {
      measure: "referenceShare",
      value: m.referenceShare,
      limit: t.referenceShareMin,
      direction: "min",
      pass: m.tutorTurnsWithPrecedingStudent > 0 ? m.referenceShare >= t.referenceShareMin : null,
    },
    {
      measure: "tutorTalkShare",
      value: m.tutorTalkShare,
      limit: t.tutorTalkShareMax,
      direction: "max",
      pass: hasWords ? m.tutorTalkShare < t.tutorTalkShareMax : null,
    },
  ];
  return { results, passed: results.every((r) => r.pass !== false) };
}

export type RunComparison = {
  measure: ShareMeasure | "multiQuestionShare";
  previous: number;
  current: number;
  /** Positive means worse, in share points (0.05 = 5 points). */
  worseBy: number;
};

/** Higher is better only for referenceShare. */
const LOWER_IS_BETTER = [
  "leadingShare",
  "longTutorTurnShare",
  "tutorTalkShare",
  "multiQuestionShare",
] as const;

/** Returns the measures that are worse by 5 points or more (section 12, last row). */
export function compareRuns(
  previous: InterviewMetrics,
  current: InterviewMetrics,
): RunComparison[] {
  const flagged: RunComparison[] = [];
  const check = (measure: RunComparison["measure"], worseBy: number, p: number, c: number) => {
    if (worseBy >= 0.05 - 1e-9) flagged.push({ measure, previous: p, current: c, worseBy });
  };
  for (const k of LOWER_IS_BETTER) check(k, current[k] - previous[k], previous[k], current[k]);
  check(
    "referenceShare",
    previous.referenceShare - current.referenceShare,
    previous.referenceShare,
    current.referenceShare,
  );
  return flagged;
}
