import { createFileRoute, Link } from "@tanstack/react-router";
import { DotPattern } from "@/components/ui/dot-pattern";
import { SiteNav } from "@/components/SiteNav";
import { INTERVIEW_MINUTES } from "@/lib/limits";

// One entry per live tutor. "Start interview" opens the interview room, which connects straight
// away behind a short waiting room; sign-in, credits and feedback rules are enforced there and on
// the server.
const SUBJECTS = [
  {
    id: "ppe",
    subject: "PPE",
    tutor: "Prof Matt",
    line: "Oxford-style Philosophy, Politics and Economics. He will test your premises.",
  },
  {
    id: "geography",
    subject: "Geography",
    tutor: "Dr River",
    line: "Built from real Cambridge geography notes. He will ask why, then ask again.",
  },
] as const;

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
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      <SiteNav back="home" />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-center text-3xl font-medium tracking-tight sm:text-4xl">
          Pick a subject
        </h1>
        <p className="mt-3 text-center text-muted-foreground">
          Up to {INTERVIEW_MINUTES} minutes, out loud. Partway through, your tutor will put a chart
          on the table for you to reason about.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {SUBJECTS.map((s) => (
            <li key={s.id} className="flex flex-col rounded-md border bg-card p-8">
              <span className="text-4xl font-medium tracking-tight sm:text-5xl">{s.subject}</span>
              <span className="mt-2 text-foreground/80">with {s.tutor}</span>
              <span className="mt-4 flex-1 text-sm text-muted-foreground">{s.line}</span>
              <Link
                to="/interview"
                search={{ tutor: s.id, start: true as const }}
                className="mt-8 self-start rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
              >
                Start interview →
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-16 rounded-md border border-dashed p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Coming soon
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-tight">Practice readings</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Some colleges give you a short article before the interview and spend the first part
            discussing it. Soon you will be able to read one here, then talk it through with your
            tutor.
          </p>
        </section>
      </main>
      <footer className="relative z-10 mx-auto max-w-3xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Not affiliated with Oxford or Cambridge. AI can make mistakes.
      </footer>
    </div>
  );
}
