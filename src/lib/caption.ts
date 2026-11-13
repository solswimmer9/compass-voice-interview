// Live captions: the words of the line being spoken, trimmed to the most recent ones so the
// caption stays two or three lines long. Pure, browser-safe.

export const CAPTION_MAX_WORDS = 28;

export type CaptionWord = {
  /** Position in the whole line, so a word keeps its key (and its fade-in) as the line grows. */
  index: number;
  text: string;
};

export function captionWords(
  text: string,
  max: number = CAPTION_MAX_WORDS,
): {
  words: CaptionWord[];
  trimmed: boolean;
} {
  const all = text.trim().split(/\s+/).filter(Boolean);
  const start = Math.max(0, all.length - max);
  return {
    words: all.slice(start).map((word, i) => ({ index: start + i, text: word })),
    trimmed: start > 0,
  };
}
