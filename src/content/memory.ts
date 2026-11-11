// Rendering of StudentMemory for prompts. Memory text is model-written, so it is cleaned and
// capped here rather than trusted. Server-only.
import { LIMITS } from "./core.ts";
import { cardById } from "./index.ts";
import type { StudentMemory } from "./types.ts";
import { countWords, truncateWords } from "./words.ts";

const ITEM_WORDS = 20;
const MAX_ITEMS = 3;
const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
const DISCRETION = "Do not mention that you have notes on them unless they ask.";

function clean(text: unknown, maxWords = ITEM_WORDS): string {
  if (typeof text !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const plain = text.replace(/[\u0000-\u001f\u007f]/gu, " ");
  return truncateWords(plain, maxWords).replace(/[.;\s]+$/u, "");
}

function items(list: unknown): string[] {
  return Array.isArray(list)
    ? list
        .map((item) => clean(item))
        .filter(Boolean)
        .slice(0, MAX_ITEMS)
    : [];
}

function interviewCount(memory: StudentMemory): number {
  const n = memory.interviews;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/** Topics already covered, most recent first, as their opening questions. Unknown ids are skipped. */
function coveredTopics(memory: StudentMemory): string[] {
  const done = Array.isArray(memory.cardsDone) ? [...memory.cardsDone] : [];
  done.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const entry of done) {
    const card = cardById(entry?.id);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    topics.push(card.opening.replace(/\?$/u, ""));
  }
  return topics.slice(0, MAX_ITEMS);
}

/**
 * The memory paragraph for the voice prompt. At most LIMITS.memoryLiveWords (80) words, always.
 * Returns "" for a first-time student. Sentences are added in priority order and skipped if
 * they would break the budget; the result is hard-truncated as a last guard.
 */
export function renderMemory(memory: StudentMemory | null | undefined): string {
  if (!memory) return "";
  const count = interviewCount(memory);
  const habits = items(memory.habits);
  const strengths = items(memory.strengths);
  const focus = clean(memory.nextFocus, 30);
  const covered = coveredTopics(memory);
  if (!count && !habits.length && !strengths.length && !focus && !covered.length) return "";

  const sentences = [
    count ? `${ORDINALS[count] ?? `Number ${count + 1}`} interview with this student.` : "",
    habits.length
      ? `Recurring habits: ${habits.join("; ")}. Hold the challenge one turn longer.`
      : "",
    focus ? `Focus this time: ${focus}.` : "",
    strengths.length ? `Strengths: ${strengths.join("; ")}.` : "",
    covered.length ? `Already covered: ${covered.join("; ")}.` : "",
  ].filter(Boolean);

  const budget = LIMITS.memoryLiveWords - countWords(DISCRETION);
  const kept: string[] = [];
  let used = 0;
  for (const sentence of sentences) {
    const words = countWords(sentence);
    if (used + words > budget) continue;
    kept.push(sentence);
    used += words;
  }
  return truncateWords([...kept, DISCRETION].join(" "), LIMITS.memoryLiveWords);
}

/** Full memory for the backend and feedback models. Not word-capped beyond the per-item caps. */
export function renderMemoryFull(memory: StudentMemory | null | undefined): string {
  if (!memory) return "First interview with this tutor; no history.";
  const done = Array.isArray(memory.cardsDone) ? memory.cardsDone : [];
  return [
    `Previous interviews: ${interviewCount(memory)}.`,
    `Cards done: ${done.map((d) => `${clean(d?.id, 1)} (${clean(d?.at, 1)})`).join(", ") || "none"}.`,
    `Strengths: ${items(memory.strengths).join("; ") || "none recorded"}.`,
    `Recurring habits: ${items(memory.habits).join("; ") || "none recorded"}.`,
    `Next focus: ${clean(memory.nextFocus, 30) || "none recorded"}.`,
  ].join("\n");
}
