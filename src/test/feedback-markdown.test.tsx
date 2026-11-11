import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackMarkdown } from "@/components/FeedbackMarkdown";
import { parseInline, parseMarkdown } from "@/lib/feedback-markdown";

describe("feedback markdown", () => {
  it("reads headings, paragraphs and both kinds of list", () => {
    const blocks = parseMarkdown(
      "## Overall impression\nA clear answer\nthat kept going.\n\n- First **point**\n- Second\n\n1. Do this\n2. Then that",
    );
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "list", "list"]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "A clear answer that kept going." }],
    });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
  });

  it("reads bold, italic and code, and leaves snake_case alone", () => {
    expect(parseInline("a **b** *c* `d` e_f_g")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " e_f_g" },
    ]);
  });

  it("shows unfinished formatting as text while feedback is still arriving", () => {
    expect(parseInline("**half")).toEqual([{ type: "text", text: "**half" }]);
  });

  it("renders structure as HTML elements", () => {
    const html = renderToStaticMarkup(
      <FeedbackMarkdown source={"## Strengths\n- Quoted **evidence**\n\nWell done."} />,
    );
    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>Quoted <strong>evidence</strong></li>");
    expect(html).toContain("<p>Well done.</p>");
  });

  it("never lets HTML in the feedback through", () => {
    const html = renderToStaticMarkup(
      <FeedbackMarkdown
        source={
          '## <img src=x onerror="alert(1)">\n<script>alert(1)</script>\n- **<b>bold</b>**\n`<iframe>`\n[link](javascript:alert(1))'
        }
      />,
    );
    expect(html).not.toMatch(/<(script|img|iframe|b|a)[\s>]/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("<strong>&lt;b&gt;bold&lt;/b&gt;</strong>");
    expect(html).not.toContain("href");
  });
});
