// A deliberately small Markdown reader for AI feedback: headings, paragraphs, bullet and
// numbered lists, bold, italic and inline code. It produces plain data that React renders as
// text, so nothing in the model's output (HTML tags, scripts, links) is ever interpreted.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list)
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const hashes = heading[1]?.length ?? 2;
      // The page title is the only h1, so feedback headings start at h2.
      const level = Math.min(4, Math.max(2, hashes)) as 2 | 3 | 4;
      blocks.push({ type: "heading", level, children: parseInline(heading[2] ?? "") });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(item[1] ?? "");
      continue;
    }
    if (list && /^\s+/.test(raw)) {
      // An indented line continues the previous list item.
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ""} ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ type: "text", text });
    text = "";
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (rest.startsWith("`")) {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        pushText();
        out.push({ type: "code", text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const end = source.indexOf(marker, i + 2);
      if (end > i + 2) {
        pushText();
        out.push({ type: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    const char = source[i] ?? "";
    if ((char === "*" || char === "_") && source[i + 1] !== " ") {
      const end = source.indexOf(char, i + 1);
      // Underscores inside words (snake_case) are left alone.
      const wordy = char === "_" && /\w/.test(source[i - 1] ?? "");
      if (end > i + 1 && !wordy && source[end - 1] !== " ") {
        pushText();
        out.push({ type: "em", children: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    text += char;
    i += 1;
  }
  pushText();
  return out;
}
