import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { READING_MINUTES, readingById } from "@/lib/readings";

export const Route = createFileRoute("/readings_/$readingId")({
  loader: ({ params }) => {
    const reading = readingById(params.readingId);
    if (!reading) throw notFound();
    return reading;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Reading"} | Practice reading` }],
  }),
  component: ReadingSessionPage,
});

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ReadingSessionPage() {
  const { readingId } = Route.useParams();
  const found = readingById(readingId);
  const storageKey = `reading-timer:${readingId}`;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      setStartedAt(Number.isFinite(saved) && saved > 0 ? saved : null);
    } catch {
      setStartedAt(null);
    }
    setNow(Date.now());
  }, [storageKey]);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  function startTimer() {
    if (startedAt !== null) return;
    const start = Date.now();
    try {
      window.localStorage.setItem(storageKey, String(start));
    } catch {
      // Storage unavailable: the timer still works for this visit.
    }
    setStartedAt(start);
    setNow(start);
  }

  if (!found) return null;
  const reading = found;
  const total = READING_MINUTES * 60;
  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, total - elapsed);
  const done = startedAt !== null && remaining === 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Link to="/readings" className="text-sm text-muted-foreground hover:text-foreground">
        ← All readings
      </Link>

      <p className="mt-12 font-mono text-xs text-muted-foreground">
        {reading.source} · {reading.usedIn}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-balance">
        {reading.title}
      </h1>

      <ol className="mt-8 space-y-4">
        <Step
          number={1}
          title={reading.searchLink ? "Find the article" : "Open the article"}
          active={startedAt === null}
          complete={startedAt !== null}
        >
          <a
            href={reading.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={startTimer}
            onAuxClick={startTimer}
            className="group mt-3 flex items-center justify-between gap-4 rounded-lg border bg-background p-4 text-left transition hover:border-foreground/40"
          >
            <span>
              <span className="block text-xs text-muted-foreground">{reading.source}</span>
              <span className="mt-0.5 block font-medium">{reading.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {reading.searchLink
                  ? "Opens a search for the article in a new tab. It may need a subscription."
                  : "Opens on the publisher's site in a new tab. Keep this page open."}
              </span>
            </span>
            <span aria-hidden="true" className="text-xl transition group-hover:translate-x-0.5">
              ↗
            </span>
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            {reading.searchLink ? "Searching" : "Opening it"} starts your {READING_MINUTES}-minute reading timer.
          </p>
        </Step>

        <Step
          number={2}
          title={`Read for ${READING_MINUTES} minutes`}
          active={startedAt !== null && !done}
          complete={done}
        >
          {startedAt === null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Your timer starts when you {reading.searchLink ? "search for" : "open"} the article.
            </p>
          ) : (
            <div className="mt-3 flex items-baseline gap-4">
              <span className="font-serif text-5xl font-semibold tabular-nums" aria-live="polite">
                {clock(remaining)}
              </span>
              <span className="text-sm text-muted-foreground">
                {done ? "Time's up." : "left. Make notes on the questions below."}
              </span>
            </div>
          )}
        </Step>

        <Step number={3} title="Talk it through with Dr River" active={done} complete={false}>
          <p className="mt-2 text-sm text-muted-foreground">
            He'll ask you to sum up the argument, then test it and share his own take.
          </p>
          <Link
            to="/"
            search={{ reading: reading.id }}
            className={`mt-4 inline-flex rounded-full px-6 py-3 font-medium transition ${
              done
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border hover:bg-secondary"
            }`}
          >
            {done ? "Start the interview" : "I'm ready early, start now"}
          </Link>
        </Step>
      </ol>

      <h2 className="mt-10 text-sm font-medium">Context</h2>
      <p className="mt-1 text-sm text-muted-foreground">{reading.context}</p>
      <h2 className="mt-6 text-sm font-medium">While you read, think about</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {reading.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </main>
  );
}

function Step({
  number,
  title,
  active,
  complete,
  children,
}: {
  number: number;
  title: string;
  active: boolean;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={`rounded-xl border p-5 transition ${
        active ? "border-foreground/40 bg-card" : complete ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
            complete
              ? "bg-accent text-accent-foreground"
              : active
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground"
          }`}
        >
          {complete ? "✓" : number}
        </span>
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </li>
  );
}
