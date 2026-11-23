import { createFileRoute, Link } from "@tanstack/react-router";
import { readingsFor } from "@/lib/readings";
import { MeridianPage, darkButton, mono, serif } from "@/components/meridian/MeridianFrame";
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
    <MeridianPage
      framed={
        <section className="px-6 pb-14 pt-8 sm:px-8">
          <Link to="/subjects" className="text-sm text-[#4a4a48] hover:underline">
            ← Back to subjects
          </Link>
          {readings.length === 0 ? (
            <div className="mx-auto max-w-2xl pt-10 text-center">
              <h1 className={`${serif} text-[clamp(40px,5vw,64px)] leading-none`}>
                {subject.name} practice readings are coming soon
              </h1>
              <p className="mt-5 text-base leading-relaxed text-[#4a4a48]">
                In the meantime you can practise a {subject.name} interview with {subject.tutor}.
              </p>
              <Link
                to="/interview"
                search={{ tutor: subject.id, start: true as const }}
                className={`${darkButton} mt-8`}
              >
                Start interview →
              </Link>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl pt-10 text-center">
              <p className={`${mono} text-xs text-[#5a5a57]`}>
                {subject.name.toUpperCase()} · PRACTICE READINGS
              </p>
              <h1
                className={`rise ${serif} mt-4 text-[clamp(44px,6vw,80px)] leading-[0.98] tracking-[-0.02em]`}
              >
                Read like it&rsquo;s <em>the real interview.</em>
              </h1>
              <p className="mx-auto mt-5 max-w-[560px] text-base leading-relaxed text-[#4a4a48]">
                Some colleges give you a short article 30 minutes before an interview, then spend
                the first 10 to 15 minutes discussing it. These are articles colleges say they have
                used. Give yourself 15 minutes with one, then {subject.tutor} will interview you on
                it.
              </p>
            </div>
          )}
        </section>
      }
    >
      {readings.length > 0 && (
        <main className="px-2 pb-24 pt-12">
          <ol className="grid gap-6 lg:grid-cols-2">
            {readings.map((reading, index) => (
              <li
                key={reading.id}
                className="lift reveal flex flex-col rounded-[14px] bg-[#f7f7f5] p-6 sm:p-8"
              >
                <p className={`${mono} text-xs text-[#5a5a57]`}>
                  0{index + 1} · {reading.source.toUpperCase()} · {reading.usedIn.toUpperCase()}
                </p>
                <h2 className={`${serif} mt-3 text-[32px] leading-tight`}>{reading.title}</h2>
                <h3 className="mt-6 text-sm font-medium">Context</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[#4a4a48]">{reading.context}</p>
                <h3 className="mt-5 text-sm font-medium">Questions to think about</h3>
                <ul className="mt-2 flex-1 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#4a4a48]">
                  {reading.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link
                    to="/readings/$readingId"
                    params={{ readingId: reading.id }}
                    className={darkButton}
                  >
                    Read for 15 minutes, then interview →
                  </Link>
                  <a
                    href={reading.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-4 hover:text-[#4a4a48]"
                  >
                    {reading.searchLink ? "Find the article ↗" : "Just read the article ↗"}
                  </a>
                </div>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-12 max-w-2xl text-center text-xs leading-relaxed text-[#5a5a57]">
            Articles belong to their publishers and open on their own sites. Some may need a
            subscription. Interview details are from the colleges&rsquo; published admissions
            feedback.
          </p>
        </main>
      )}
    </MeridianPage>
  );
}
