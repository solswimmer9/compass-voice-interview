import { createFileRoute, Link } from "@tanstack/react-router";
import { readingsFor } from "@/lib/readings";
import { SiteNav } from "@/components/SiteNav";
import { SUBJECTS, subjectById, type SubjectId } from "@/lib/subjects";

export const Route = createFileRoute("/readings")({
  // subject: whose readings to show. Old links without one were Geography's (the only subject
  // with readings when this page was made).
  validateSearch: (search: Record<string, unknown>): { subject: SubjectId } => ({
    subject: subjectById(search["subject"])?.id ?? "geography",
  }),
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
  const { subject: subjectId } = Route.useSearch();
  const subject = subjectById(subjectId) ?? SUBJECTS[0]!;
  const readings = readingsFor(subject.id);
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
        <Link to="/subjects" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to subjects
        </Link>

        {readings.length === 0 ? (
          <section className="mt-12">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {subject.name} practice readings are coming soon
            </h1>
            <p className="mt-4 text-muted-foreground">
              In the meantime you can practise a {subject.name} interview with {subject.tutor}.
            </p>
            <Link
              to="/interview"
              search={{ tutor: subject.id, start: true as const }}
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
            >
              Start interview →
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-12">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                {subject.name} · Practice readings
              </p>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-balance">
                Read like it&rsquo;s the real interview.
              </h1>
              <p className="mt-4 text-muted-foreground">
                Some colleges give you a short article 30 minutes before an interview, then spend
                the first 10 to 15 minutes discussing it. Each article says where it comes from.
                Give yourself 15 minutes with one, then {subject.tutor} will interview you on it.
              </p>
            </section>

            <ol className="mt-10 space-y-6">
              {readings.map((reading, index) => (
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
              subscription. Interview details are from the colleges&rsquo; published admissions
              feedback. This site is not affiliated with the University of Oxford or the University
              of Cambridge.
            </p>
          </>
        )}
      </main>
    </>
  );
}
