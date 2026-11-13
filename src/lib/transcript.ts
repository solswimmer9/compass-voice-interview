// Live transcript assembly: the voice stream sends overlapping fragments per speaker,
// which are merged into readable lines in time order.
export type Fragment = { text: string; start: number; end: number; sequence: number };
export type Line = {
  role: "user" | "assistant";
  text: string;
  start: number;
  end: number;
  fragments: Fragment[];
};

export function appendTranscriptFragment(
  lines: Line[],
  role: Line["role"],
  fragment: Fragment,
): Line[] {
  const next = [...lines];
  let index = -1;
  for (let candidate = next.length - 1; candidate >= 0; candidate--) {
    const line = next[candidate]!;
    if (
      line.role === role &&
      fragment.start <= line.end + 500 &&
      fragment.end >= line.start - 500
    ) {
      index = candidate;
      break;
    }
  }
  if (index < 0 && next.at(-1)?.role === role) index = next.length - 1;
  if (index < 0) {
    return [
      ...next,
      {
        role,
        text: fragment.text,
        start: fragment.start,
        end: fragment.end,
        fragments: [fragment],
      },
    ];
  }
  const line = next[index]!;
  const fragments = [...line.fragments, fragment].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.sequence - b.sequence,
  );
  next[index] = {
    ...line,
    start: Math.min(line.start, fragment.start),
    end: Math.max(line.end, fragment.end),
    fragments,
    text: fragments.map((part) => part.text).join(""),
  };
  return next;
}
