import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FlippingWord } from "@/components/FlippingWord";
import { TutorOrb } from "@/components/TutorOrb";
import { DotPattern } from "@/components/ui/dot-pattern";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { parseInterviewSearch } from "@/lib/interview-search";

const HEADLINE_WORDS = ["democratise", "open up", "demystify", "widen access to"];

const SUBJECTS = [
  {
    subject: "PPE",
    tutor: "Prof Matt",
    tone: "matt" as const,
    line: "Philosophy, Politics and Economics, Oxford style.",
    search: { tutor: "ppe" as const },
  },
  {
    subject: "Geography",
    tutor: "Dr River",
    tone: "river" as const,
    line: "Built from real Cambridge geography notes.",
    search: {},
  },
];

export const Route = createFileRoute("/")({
  // Old links put the interview on the home page (/?tutor=ppe, /?reading=...). Send them to the room.
  validateSearch: parseInterviewSearch,
  beforeLoad: ({ search }) => {
    if (search.tutor || search.reading) throw redirect({ to: "/interview", search });
  },
  head: () => ({
    meta: [
      { title: "We are here to democratise Oxbridge" },
      {
        name: "description",
        content:
          "Practise your Oxbridge interview out loud with an AI tutor who challenges your reasoning like a real interviewer.",
      },
      { property: "og:title", content: "We are here to democratise Oxbridge" },
      {
        property: "og:description",
        content: "Practise your Oxbridge interview out loud, then get feedback on your reasoning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const account = useAccountSnapshot();
  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      <nav className="relative z-20 mx-auto flex max-w-3xl items-center justify-end gap-5 px-6 pt-6 text-sm">
        <Link to="/readings" className="text-muted-foreground transition hover:text-foreground">
          Readings
        </Link>
        <Link to="/pricing" className="text-muted-foreground transition hover:text-foreground">
          Pricing
        </Link>
        {account.user ? (
          <Link to="/account" className="underline">
            Your account
          </Link>
        ) : (
          <Link to="/auth" className="underline">
            Sign in
          </Link>
        )}
      </nav>

      <main className="relative z-10 mx-auto max-w-3xl px-6">
        <section className="flex min-h-[80svh] flex-col items-center justify-center text-center">
          <h1
            aria-label="We are here to democratise Oxbridge"
            className="text-4xl font-medium leading-tight tracking-tighter sm:text-6xl"
          >
            <span aria-hidden="true" className="block">
              We are here to
            </span>
            <span aria-hidden="true" className="block">
              <FlippingWord words={HEADLINE_WORDS} />
            </span>
            <span aria-hidden="true" className="block">
              Oxbridge
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg bg-background text-lg text-foreground/90 shadow-[0_0_20px_16px_var(--background)]">
            Practise your interview out loud with an AI tutor who challenges your reasoning. Built
            by Cambridge students.
          </p>
          <a
            href="#subjects"
            className="mt-8 rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Choose your subject
          </a>
        </section>

        <section id="subjects" className="scroll-mt-10 pb-20">
          <ul className="grid gap-4 sm:grid-cols-2">
            {SUBJECTS.map((s) => (
              <li key={s.subject}>
                <Link
                  to="/interview"
                  search={s.search}
                  className="group flex h-full items-center gap-6 rounded-md border bg-card p-6 transition hover:border-accent"
                >
                  <TutorOrb tone={s.tone} state="idle" size={64} />
                  <span className="flex-1">
                    <span className="block text-2xl font-medium tracking-tight">{s.subject}</span>
                    <span className="block text-sm text-foreground/80">with {s.tutor}</span>
                    <span className="mt-2 block text-sm text-muted-foreground">{s.line}</span>
                  </span>
                  <span className="text-xl text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <ol className="mt-14 grid gap-6 text-sm sm:grid-cols-3">
            <li>
              <p className="font-medium">1. Talk</p>
              <p className="mt-1 text-muted-foreground">
                Up to {INTERVIEW_MINUTES} minutes, out loud, like the real thing.
              </p>
            </li>
            <li>
              <p className="font-medium">2. Get feedback</p>
              <p className="mt-1 text-muted-foreground">
                See where your reasoning held and where it slipped.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Read back</p>
              <p className="mt-1 text-muted-foreground">Replay the transcript of how you argued.</p>
            </li>
          </ol>
        </section>
      </main>
      <footer className="relative z-10 mx-auto max-w-3xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Not affiliated with Oxford or Cambridge. AI can make mistakes.
      </footer>
    </div>
  );
}
