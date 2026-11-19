import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { readingsFor } from "@/lib/readings";
import { SUBJECTS } from "@/lib/subjects";

// "Start interview" opens the interview room, which connects straight away behind a short waiting
// room. A subject with practice readings also offers "start with a reading". Sign-in, credits and
// feedback rules are enforced in the room and on the server.

export const Route = createFileRoute("/subjects")({
  head: () => ({
    meta: [
      { title: "Pick a subject | Oxbridge Interview Practice" },
      { name: "description", content: "Pick a subject and start a practice Oxbridge interview." },
      { property: "og:title", content: "Pick a subject" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <SiteNav back="home" />
      <main className="relative z-10 mx-auto max-w-[1050px] px-6 py-24">
        <h1 className="t-display text-center">Pick a subject</h1>
        <p className="t-lead mx-auto mt-6 max-w-[840px] text-center text-muted-foreground">
          Up to {INTERVIEW_MINUTES} minutes, out loud. Partway through, your tutor will put a chart
          on the table for you to reason about.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {SUBJECTS.map((s) => {
            const readings = readingsFor(s.id);
            return (
              <li key={s.id} className="flex flex-col rounded-[28px] bg-card p-8 sm:p-10">
                <span className="t-heading">{s.name}</span>
                <span className="mt-2 text-foreground/80">with {s.tutor}</span>
                <span className="mt-4 flex-1 text-sm text-muted-foreground">{s.line}</span>
                <Link
                  to="/interview"
                  search={{ tutor: s.id, start: true as const }}
                  className="btn-pill mt-8 self-start"
                >
                  Start interview
                </Link>
                {readings.length > 0 ? (
                  <Link
                    to="/readings"
                    search={{ subject: s.id }}
                    className="mt-4 self-start text-sm text-action"
                  >
                    Or start with a practice reading ({readings.length} articles)
                  </Link>
                ) : (
                  <span className="mt-4 text-sm text-muted-foreground">
                    Practice readings coming soon
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
