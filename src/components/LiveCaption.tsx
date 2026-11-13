import { captionWords } from "@/lib/caption";

/**
 * The live room's caption: the latest line of the conversation, large for the tutor and
 * quieter for the student. New words fade in as they are spoken (no fade with reduced motion).
 */
export function LiveCaption({
  role,
  text,
  tutorName,
  compact = false,
}: {
  role: "user" | "assistant" | null;
  text: string;
  tutorName: string;
  /** Smaller text, for when a chart shares the room. */
  compact?: boolean;
}) {
  const { words, trimmed } = captionWords(text);
  const tutor = role === "assistant";
  return (
    <div
      aria-live="polite"
      aria-label={role ? `${tutor ? tutorName : "You"}: ${text}` : undefined}
      className="mx-auto mt-10 min-h-[6.5rem] max-w-3xl px-2 text-center sm:mt-12"
    >
      {role && words.length > 0 && (
        <>
          {!tutor && (
            <p
              aria-hidden="true"
              className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground"
            >
              You
            </p>
          )}
          <p
            aria-hidden="true"
            className={
              tutor
                ? `text-2xl font-medium leading-snug tracking-tight ${compact ? "sm:text-[1.75rem]" : "sm:text-4xl"}`
                : `text-lg leading-snug text-foreground/75 ${compact ? "sm:text-xl" : "sm:text-2xl"}`
            }
          >
            {trimmed && "… "}
            {words.map((word) => (
              <span key={word.index} className="caption-word">
                {word.text}{" "}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
