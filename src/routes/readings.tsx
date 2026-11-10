import { createFileRoute, Link } from "@tanstack/react-router";
import { READINGS } from "@/lib/readings";

export const Route = createFileRoute("/readings")({
  head: () => ({
    meta: [
      { title: "Practice readings | Oxbridge Interview Practice" },
      {
        name: "description",
        content:
          "Articles Oxford tutors have used in geography interviews, with context and questions to practise with.",
      },
      { property: "og:title", content: "Geography interview practice readings" },
      {
        property: "og:description",
        content: "Real interview articles, with context and practice questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReadingsPage,
});

function ReadingsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to interview practice
      </Link>

      <section className="mt-12">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Practice readings
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-balance">
          Read like it&rsquo;s the real interview.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Some colleges give you a short article 30 minutes before an interview, then spend the
          first 10 to 15 minutes discussing it. These are articles Keble College, Oxford, says it
          used. Give yourself 15 minutes with one, then work through the questions out loud.
        </p>
      </section>

      <ol className="mt-10 space-y-6">
        {READINGS.map((reading, index) => (
          <li key={reading.id} className="rounded-xl border bg-card p-6">
            <p className="font-mono text-xs text-muted-foreground">
              0{index + 1} · {reading.source} · {reading.usedIn}
            </p>
            <h2 className="mt-2 text-xl font-semibold">{reading.title}</h2>
            <a
              href={reading.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {reading.searchLink ? "Find the article ↗" : "Read the article ↗"}
            </a>
            <Link
              to="/readings/$readingId"
              params={{ readingId: reading.id }}
              className="ml-3 mt-3 inline-flex rounded-full border px-5 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              Read for 15 minutes, then interview
            </Link>
            <h3 className="mt-6 text-sm font-medium">Context</h3>
            <p className="mt-1 text-sm text-muted-foreground">{reading.context}</p>
            <h3 className="mt-5 text-sm font-medium">Questions to think about</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {reading.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-xs text-muted-foreground">
        Articles belong to their publishers and open on their own sites. Some may need a
        subscription. Interview details are from Keble College&rsquo;s published geography
        admissions feedback. This site is not affiliated with the University of Oxford or the
        University of Cambridge.
      </p>
    </main>
  );
}
