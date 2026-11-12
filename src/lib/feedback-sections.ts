type Section = { title: string; lines: string[] };

/** Splits the streamed markdown into its "## Heading" sections so each reads as its own card. */
export function splitFeedback(text: string): Section[] {
  const sections: Section[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\*\*/g, "").trimEnd();
    const heading = /^#+\s*(.+)$/.exec(line);
    if (heading) {
      sections.push({ title: heading[1]!.replace(/\s*\(.*\)\s*$/, ""), lines: [] });
      continue;
    }
    if (!line.trim()) continue;
    if (sections.length === 0) sections.push({ title: "", lines: [] });
    sections.at(-1)!.lines.push(line.trim());
  }
  return sections;
}
