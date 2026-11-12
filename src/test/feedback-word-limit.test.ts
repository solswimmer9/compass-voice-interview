import { describe, expect, it } from "vitest";
import {
  FEEDBACK_WORD_LIMIT,
  countWords,
  createWordLimiter,
  limitWords,
} from "@/lib/feedback/word-limit";

const sentence = (n: number, word = "word") =>
  `${"Alpha".concat(" ", Array.from({ length: n - 1 }, () => word).join(" "))}.`;

function report(sections: [string, string[]][]): string {
  return sections.map(([h, lines]) => `## ${h}\n${lines.join("\n")}`).join("\n\n");
}

/** Feeds text to a limiter in small, uneven pieces, as a model stream would. */
function streamThrough(text: string, max?: number, size = 7): string {
  const limiter = createWordLimiter(max);
  let out = "";
  for (let i = 0; i < text.length; i += size) {
    out += limiter.push(text.slice(i, i + size));
    if (limiter.done) break;
  }
  return out + limiter.end();
}

describe("countWords", () => {
  it("counts words a reader sees, not Markdown marks", () => {
    expect(countWords('## Overall impression\n- You said "cities grow" [T2].')).toBe(7);
    expect(countWords("")).toBe(0);
    expect(countWords(" - ## ** ")).toBe(0);
  });
});

describe("limitWords", () => {
  it("returns text within the limit unchanged, byte for byte", () => {
    const text = "## Overall impression\nShort and fine.\n\n## Try this next\nWhy?  \n";
    expect(limitWords(text)).toEqual({ text, truncated: false });
    expect(FEEDBACK_WORD_LIMIT).toBe(400);
  });

  it("cuts at a sentence boundary and never exceeds the limit", () => {
    const body = Array.from(
      { length: 60 },
      (_, i) => `Sentence ${i} has exactly seven words here.`,
    );
    const text = `## Overall impression\n${body.join(" ")}`;
    const { text: out, truncated } = limitWords(text);
    expect(truncated).toBe(true);
    expect(countWords(out)).toBeLessThanOrEqual(400);
    expect(out.endsWith("words here.")).toBe(true);
    expect(text.startsWith(out)).toBe(true);
    // Uses the room it has: one more sentence would go over.
    expect(countWords(out) + 7).toBeGreaterThan(400);
  });

  it("never leaves an empty heading or half a heading at the end", () => {
    const text = report([
      ["Overall impression", [sentence(150)]],
      ["Strengths in reasoning", [`- ${sentence(150)}`, `- ${sentence(80)}`]],
      ["Where the reasoning slipped", [`- ${sentence(90)}`]],
    ]);
    const { text: out } = limitWords(text);
    expect(countWords(out)).toBeLessThanOrEqual(400);
    expect(out).not.toMatch(/##[^\n]*$/); // does not end on a heading
    expect(out).not.toContain("Where the reasoning slipped");
    expect(out.split("\n").at(-1)).toMatch(/^- Alpha/);
  });

  it("drops a heading whose first sentence does not fit", () => {
    const text = report([
      ["Overall impression", [sentence(390)]],
      ["Try this next", [sentence(20)]],
    ]);
    const { text: out } = limitWords(text);
    expect(out).not.toContain("Try this next");
    expect(out.endsWith("word.")).toBe(true);
  });

  it("cuts a single enormous sentence at a word boundary with an ellipsis", () => {
    const text = `## Overall impression\n${Array.from({ length: 500 }, () => "word").join(" ")}`;
    const { text: out, truncated } = limitWords(text);
    expect(truncated).toBe(true);
    expect(out.startsWith("## Overall impression\nword")).toBe(true);
    expect(out.endsWith("word…")).toBe(true);
    expect(countWords(out)).toBe(400);
  });

  it("splits sentences inside bullets and after closing quotes", () => {
    const filler = Array.from({ length: 49 }, () => "Six words are in each sentence.").join(" ");
    const text = `## A\n- ${filler} You said "it floods." Then more words follow here.`;
    const { text: out } = limitWords(text, 300);
    expect(out.endsWith('You said "it floods."')).toBe(true);
  });

  it("is safe with non-text input", () => {
    expect(limitWords(undefined as unknown as string)).toEqual({ text: "", truncated: false });
  });
});

describe("createWordLimiter (streaming)", () => {
  const long = report([
    ["Overall impression", [`${sentence(60)} ${sentence(60)}`]],
    ["Strengths in reasoning", [`- ${sentence(100)}`, `- ${sentence(100)}`]],
    ["Where the reasoning slipped", [`- ${sentence(70)}`]],
    ["Try this next", [sentence(30)]],
  ]);
  const short = report([
    ["Overall impression", ["You explained it. Then you changed scale."]],
    ["Try this next", ["What if the river were larger?"]],
  ]);

  it("emits exactly what limitWords would, whatever the chunk size", () => {
    for (const text of [long, short, `${short}\n`]) {
      for (const size of [1, 3, 7, 50, 10_000]) {
        expect(streamThrough(text, undefined, size)).toBe(limitWords(text).text);
      }
    }
  });

  it("does not send a heading before any text under it", () => {
    const limiter = createWordLimiter();
    expect(limiter.push("## Overall impression\n")).toBe("");
    expect(limiter.push("You reasoned")).toBe("");
    expect(limiter.push(" well. And")).toBe("## Overall impression\nYou reasoned well.");
    expect(limiter.end()).toBe(" And");
  });

  it("stops once the limit is reached and ignores the rest", () => {
    const limiter = createWordLimiter(10);
    // "H" counts as one word, so two sentences fill the limit exactly.
    let out = limiter.push(
      "## H\nOne two three four. Five six seven eight nine. Ten eleven twelve. ",
    );
    expect(limiter.done).toBe(false);
    out += limiter.push("More text that should never appear.");
    expect(limiter.done).toBe(true);
    out += limiter.push(" Even more.");
    out += limiter.end();
    expect(out).toBe("## H\nOne two three four. Five six seven eight nine.");
  });
});

describe("verifier findings", () => {
  it("does not treat an abbreviation's full stop as the end of a sentence", () => {
    const text = "## H\nAlpha beta. See Dr. Smith and e.g. Jones now.";
    expect(limitWords(text, 6).text).toBe("## H\nAlpha beta.");
    expect(limitWords("## H\nAlpha beta. Ask J. Smith about it.", 5).text).toBe(
      "## H\nAlpha beta.",
    );
    // A real sentence end is still found.
    expect(limitWords("## H\nAlpha beta. Gamma delta. Epsilon zeta eta.", 5).text).toBe(
      "## H\nAlpha beta. Gamma delta.",
    );
  });

  it("treats a bold-only line as a heading and never ends on it", () => {
    for (const bold of ["**Strengths**", "__Try this next:__", "  **Where it slipped** "]) {
      const text = `## Overall\n${sentence(390)}\n\n${bold}\n${sentence(50)}`;
      const out = limitWords(text).text;
      expect(out.endsWith("word.")).toBe(true);
      expect(out).not.toContain(bold.trim());
    }
    // A bold phrase inside a sentence is still text.
    const inline = `## Overall\n${sentence(390)}\n\n**Key point:** you changed scale. ${sentence(50)}`;
    expect(limitWords(inline).text).toContain("**Key point:** you changed scale.");
  });

  it("streams bold headings and abbreviations exactly as limitWords cuts them", () => {
    const text = [
      "## Overall",
      `${sentence(150)} Ask Dr. River, e.g. Prof. Matt. ${sentence(100)}`,
      "",
      "**Strengths. Then more**",
      `- ${sentence(120)}`,
      "**Next**",
      sentence(60),
    ].join("\n");
    for (const size of [1, 2, 5, 9, 40]) {
      expect(streamThrough(text, undefined, size)).toBe(limitWords(text).text);
      expect(streamThrough(text, 270, size)).toBe(limitWords(text, 270).text);
    }
  });
});
