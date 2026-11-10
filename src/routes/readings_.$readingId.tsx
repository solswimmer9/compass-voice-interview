import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmailReadingButton } from "@/components/EmailReadingButton";
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
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

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

      <section className="mt-8 rounded-xl border bg-card p-6 text-center">
        {startedAt === null ? (
          <>
            <p className="text-sm text-muted-foreground">
              Like the real thing: {READING_MINUTES} minutes to read, then Dr River interviews you
              on it.
            </p>
            <button
              type="button"
              onClick={() => {
                setStartedAt(Date.now());
                setNow(Date.now());
                window.open(reading.url, "_blank", "noopener,noreferrer");
              }}
              className="mt-5 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
            >
              Open the article and start the {READING_MINUTES}-minute timer
            </button>
          </>
        ) : (
          <>
            <p className="font-serif text-6xl font-semibold tabular-nums" aria-live="polite">
              {clock(remaining)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {done ? "Time's up. Dr River is ready for you." : "Reading time remaining"}
            </p>
            <a
              href={reading.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm underline"
            >
              Reopen the article ↗
            </a>
          </>
        )}
        <div className="mt-6">
          <Link
            to="/"
            search={{ reading: reading.id }}
            className={`inline-flex rounded-full px-6 py-3 font-medium transition ${
              done
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border hover:bg-secondary"
            }`}
          >
            {done ? "Start the interview" : "I'm ready, start the interview now"}
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-xl border p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Not ready now? Get the article, context and questions by email, with a link to start the
          interview later.
        </p>
        <div className="mt-3">
          <EmailReadingButton readingId={reading.id} />
        </div>
      </section>

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
