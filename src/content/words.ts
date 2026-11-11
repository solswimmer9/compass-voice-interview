/** Words as whitespace-separated tokens. The unit for every budget in src/content. */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

/** The first `max` words of text, whitespace collapsed. Never returns more than `max` words. */
export function truncateWords(text: string, max: number): string {
  return text.split(/\s+/u).filter(Boolean).slice(0, Math.max(0, max)).join(" ");
}
