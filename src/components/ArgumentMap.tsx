import type { ArgumentMap as ArgumentMapData, ResponseStatus } from "@/lib/feedback/argument-map";

const AMBER = "oklch(0.8 0.11 75)";
const GREEN = "oklch(0.75 0.13 150)";
const RED = "oklch(0.65 0.18 25)";

const STATUS: Record<ResponseStatus, { label: string; color: string; dashed: boolean }> = {
  held: { label: "Held", color: GREEN, dashed: false },
  unanswered: { label: "Unanswered", color: RED, dashed: true },
  try_next_time: { label: "Try next time", color: RED, dashed: true },
};

function Node({
  label,
  text,
  color,
  dashed = false,
  className = "",
}: {
  label: string;
  text: string;
  color?: string;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm border bg-background px-3 py-2 ${dashed ? "border-dashed" : ""} ${className}`}
      style={color ? { borderColor: color } : undefined}
    >
      <p
        className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground"
        style={color ? { color } : undefined}
      >
        {label}
      </p>
      <p className="mt-1 text-sm leading-snug">{text}</p>
    </div>
  );
}

// Connector lines: each item in a branch list draws its own piece of the vertical trunk and
// a horizontal stub, so the trunk always runs from the first child to the last.
const branchItem =
  "relative py-1.5 pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-muted-foreground/40 first:before:top-1/2 last:before:bottom-1/2 after:absolute after:left-0 after:top-1/2 after:h-px after:w-5 after:bg-muted-foreground/40";

// Mobile: indented list; the trunk runs down the left and each child gets a stub at its label.
const stackItem =
  "relative pl-5 pt-3 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-muted-foreground/40 last:before:h-[1.6rem] after:absolute after:left-0 after:top-[1.6rem] after:h-px after:w-4 after:bg-muted-foreground/40";

export function ArgumentMap({ map, tutorName }: { map: ArgumentMapData; tutorName: string }) {
  const pushed = `${tutorName} pushed`;
  return (
    <section aria-labelledby="argument-map-title" className="mt-10 rounded-md border bg-card p-5">
      <h3
        id="argument-map-title"
        className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        Argument map
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your main claim, where {tutorName} pushed, and how your answers stood up.
      </p>

      {/* Desktop: left-to-right tree */}
      <div className="mt-5 hidden items-center sm:flex">
        <Node label="Your claim" text={map.claim} className="w-[30%] shrink-0" />
        <div aria-hidden className="h-px w-5 shrink-0 bg-muted-foreground/40" />
        <ul className="min-w-0 flex-1">
          {map.challenges.map((challenge, i) => (
            <li key={i} className={branchItem}>
              <div className="flex items-center">
                <Node
                  label={pushed}
                  text={challenge.text}
                  color={AMBER}
                  className="w-[45%] shrink-0"
                />
                {challenge.responses.length > 0 && (
                  <>
                    <div aria-hidden className="h-px w-5 shrink-0 bg-muted-foreground/40" />
                    <ul className="min-w-0 flex-1">
                      {challenge.responses.map((response, j) => (
                        <li key={j} className={branchItem}>
                          <Node
                            label={STATUS[response.status].label}
                            text={response.text}
                            color={STATUS[response.status].color}
                            dashed={STATUS[response.status].dashed}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile: indented vertical list */}
      <div className="mt-5 sm:hidden">
        <Node label="Your claim" text={map.claim} />
        <ul className="ml-3">
          {map.challenges.map((challenge, i) => (
            <li key={i} className={stackItem}>
              <Node label={pushed} text={challenge.text} color={AMBER} />
              {challenge.responses.length > 0 && (
                <ul className="ml-3">
                  {challenge.responses.map((response, j) => (
                    <li key={j} className={stackItem}>
                      <Node
                        label={STATUS[response.status].label}
                        text={response.text}
                        color={STATUS[response.status].color}
                        dashed={STATUS[response.status].dashed}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Legend color={AMBER} label={pushed} />
        <Legend color={GREEN} label="Held" />
        <Legend color={RED} label="Unanswered / try next time" dashed />
      </ul>
    </section>
  );
}

function Legend({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block size-3 rounded-sm border ${dashed ? "border-dashed" : ""}`}
        style={{ borderColor: color }}
      />
      {label}
    </li>
  );
}
