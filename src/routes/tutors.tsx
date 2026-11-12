import { createFileRoute, Link } from "@tanstack/react-router";
import { DotPattern } from "@/components/ui/dot-pattern";

// One entry per live tutor. Each card opens the interview page for that tutor;
// sign-in, credits and feedback rules are enforced there and on the server.
const TUTORS = [
  { subject: "PPE", tutor: "Prof Matt", search: { tutor: "ppe" as const } },
  { subject: "Geography", tutor: "Dr River", search: {} },
];

export const Route = createFileRoute("/tutors")({
  head: () => ({
    meta: [
      { title: "Choose your interview | Oxbridge Interview Practice" },
      { name: "description", content: "Pick a subject and start a practice Oxbridge interview." },
      { property: "og:title", content: "Choose your interview" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TutorsPage,
});

function TutorsPage() {
  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      <nav className="relative z-20 mx-auto flex max-w-3xl items-center px-6 pt-6 text-sm">
        <Link to="/" className="text-muted-foreground transition hover:text-foreground">
          ← Home
        </Link>
      </nav>
      <main className="relative z-10 mx-auto flex min-h-[85svh] max-w-3xl flex-col justify-center px-6 py-16">
        <h1 className="text-center text-2xl font-medium tracking-tight sm:text-3xl">
          Choose your interview
        </h1>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {TUTORS.map((t) => (
            <li key={t.subject}>
              <Link
                to="/interview"
                search={t.search}
                className="group flex h-full flex-col rounded-md border bg-card p-8 transition hover:border-accent"
              >
                <span className="text-4xl font-medium tracking-tight sm:text-5xl">{t.subject}</span>
                <span className="mt-2 text-foreground/80">with {t.tutor}</span>
                <span className="mt-10 self-start rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition group-hover:opacity-90">
                  Interview →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
