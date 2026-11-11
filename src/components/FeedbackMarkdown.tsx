import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/feedback-markdown";

// Renders AI feedback Markdown as React elements. Text always goes through React's escaping;
// there is no dangerouslySetInnerHTML, so HTML in the model's output shows as plain text.

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "code":
        return (
          <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
            {node.text}
          </code>
        );
    }
  });
}

export function FeedbackMarkdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {parseMarkdown(source).map((block, index) => {
        if (block.type === "heading") {
          const className = "mt-5 font-serif font-semibold first:mt-0";
          if (block.level === 2)
            return (
              <h3 key={index} className={`${className} text-xl`}>
                {renderInline(block.children)}
              </h3>
            );
          return (
            <h4 key={index} className={`${className} text-lg`}>
              {renderInline(block.children)}
            </h4>
          );
        }
        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ));
          return block.ordered ? (
            <ol key={index} className="list-decimal space-y-1 pl-6">
              {items}
            </ol>
          ) : (
            <ul key={index} className="list-disc space-y-1 pl-6">
              {items}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block.children)}</p>;
      })}
    </div>
  );
}
