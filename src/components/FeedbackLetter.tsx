import { useState } from "react";
import {
  letterBlocks,
  letterSalutation,
  letterText,
  type TutorLetterInfo,
} from "@/lib/feedback/argument-map";

const PAPER = "oklch(0.95 0.02 85)";
const INK = "oklch(0.22 0.02 60)";
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';

export function FeedbackLetter({
  tutor,
  studentName,
  body,
  writing,
  date = new Date(),
}: {
  tutor: TutorLetterInfo;
  studentName?: string | null | undefined;
  /** Feedback text so far (the argument map block already removed). */
  body: string;
  /** True while the text is still streaming in. */
  writing: boolean;
  date?: Date;
}) {
  const blocks = letterBlocks(body);
  const dated = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const done = !writing && blocks.length > 0;

  return (
    <>
      <article
        aria-label={`Feedback letter from ${tutor.name}`}
        aria-busy={writing}
        className="relative mt-8 rounded-sm px-5 pb-10 pt-6 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)] sm:px-10 sm:pb-12 sm:pt-8 motion-safe:sm:-rotate-1"
        style={{ background: PAPER, color: INK, fontFamily: SERIF }}
      >
        <header
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-3 text-[0.7rem] uppercase tracking-[0.2em]"
          style={{ borderColor: "oklch(0.22 0.02 60 / 0.2)", fontFamily: "var(--font-sans)" }}
        >
          <span>From the desk of {tutor.name}</span>
          <span aria-hidden>·</span>
          <time dateTime={date.toISOString().slice(0, 10)} className="opacity-70">
            {dated}
          </time>
        </header>

        <p className="mt-6 text-lg">{letterSalutation(studentName)}</p>

        <div className="mt-4 space-y-4 text-[1.05rem] leading-relaxed">
          {blocks.length === 0 && writing && (
            <p className="italic opacity-70">
              {tutor.name} is writing<span className="motion-safe:animate-pulse">…</span>
            </p>
          )}
          {blocks.map((block, i) => {
            if (block.kind === "heading")
              return (
                <h3 key={i} className="pt-2 text-base font-semibold italic">
                  {block.text}
                </h3>
              );
            if (block.kind === "list") {
              const List = block.ordered ? "ol" : "ul";
              return (
                <List
                  key={i}
                  className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5 marker:opacity-60`}
                >
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </List>
              );
            }
            return <p key={i}>{block.text}</p>;
          })}
          {writing && blocks.length > 0 && (
            <span
              aria-hidden
              className="inline-block h-4 w-px translate-y-0.5 motion-safe:animate-pulse"
              style={{ background: INK }}
            />
          )}
        </div>

        {done && (
          <footer className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p>With best wishes,</p>
              <p className="mt-2 text-2xl italic">{tutor.name}</p>
            </div>
            <WaxSeal initials={tutor.initials} />
          </footer>
        )}
      </article>
      {done && (
        <LetterActions
          text={letterText(letterSalutation(studentName), body, tutor.name, dated)}
          fileName={`compass-feedback-${tutor.name}-${date.toISOString().slice(0, 10)}`}
        />
      )}
    </>
  );
}

/** The letter is only kept for this browser tab, so let students keep their own copy. */
function LetterActions({ text, fileName }: { text: string; fileName: string }) {
  const [copied, setCopied] = useState(false);
  const button = "rounded-full border px-5 py-2 text-sm";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/[^\w-]+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" onClick={download} className={button}>
        Download letter
      </button>
      <button type="button" onClick={copy} className={button}>
        {copied ? "Copied" : "Copy letter"}
      </button>
      <span className="text-sm text-muted-foreground">
        Save a copy: this letter is not kept after you close the tab.
      </span>
    </div>
  );
}

function WaxSeal({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden
      className="grid size-16 shrink-0 place-items-center rounded-full text-lg font-semibold tracking-wider motion-safe:-rotate-12"
      style={{
        background:
          "radial-gradient(circle at 35% 30%, oklch(0.62 0.2 27), oklch(0.45 0.18 25) 60%, oklch(0.36 0.14 25))",
        color: "oklch(0.88 0.06 40)",
        boxShadow:
          "0 3px 6px oklch(0.2 0.05 25 / 0.45), inset 0 0 0 4px oklch(0.4 0.16 25), inset 0 0 0 5px oklch(0.6 0.18 27 / 0.6)",
        fontFamily: "var(--font-sans)",
        textShadow: "0 -1px 0 oklch(0.3 0.1 25)",
      }}
    >
      {initials}
    </div>
  );
}
