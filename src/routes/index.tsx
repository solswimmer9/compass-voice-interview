import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  hasChosenSubject,
  parseInterviewChoice,
  takeChoiceAfterSignIn,
} from "@/lib/interview-choice";
import { FlippingWord } from "@/components/FlippingWord";
import { DotPattern } from "@/components/ui/dot-pattern";
import { SiteNav } from "@/components/SiteNav";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";

const HEADLINE_WORDS = ["democratise", "open up", "demystify", "widen access to"];

export const Route = createFileRoute("/")({
  // The interview used to live on this page (/?tutor=ppe&start=true, /?reading=...). Old links
  // and bookmarks go to the interview room with the same choice.
  validateSearch: (search: Record<string, unknown>) => ({
    ...parseInterviewChoice(search),
    ...(search["start"] === true || search["start"] === "true" ? { start: true as const } : {}),
  }),
  beforeLoad: ({ search }) => {
    if (hasChosenSubject(search)) throw redirect({ to: "/interview", search });
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
        content:
          "Practise your Oxbridge interview out loud, then get a feedback letter from your tutor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const account = useAccountSnapshot();
  const navigate = useNavigate();

  // Back from a sign-in that left the site (Google, email confirmation) with a subject chosen:
  // carry straight on into that interview.
  const signedIn = Boolean(account.user);
  useEffect(() => {
    if (!signedIn) return;
    const remembered = takeChoiceAfterSignIn();
    if (remembered) {
      void navigate({ to: "/interview", search: { ...remembered, start: true }, replace: true });
    }
  }, [signedIn, navigate]);

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      <SiteNav />
      <main className="relative z-10 mx-auto flex min-h-[85svh] max-w-2xl flex-col justify-center px-6 py-16 text-center">
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
        <div className="mx-auto mt-6 max-w-xl bg-background shadow-[0_0_20px_16px_var(--background)]">
          <p className="text-lg font-medium">
            Built by Cambridge students for applicants, based on real context.
          </p>
          <p className="mt-3 text-foreground/90">
            Practise out loud with an AI tutor for your subject, who will challenge your reasoning
            like a real interviewer.
          </p>
        </div>
        <div className="mt-8">
          <Link
            to="/subjects"
            className="inline-flex rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start practising
          </Link>
        </div>
        <ol className="mt-12 grid gap-3 text-left text-sm sm:grid-cols-3">
          <li className="rounded-md border bg-card p-3">
            <span className="font-medium">1. Pick a subject.</span>{" "}
            <span className="text-muted-foreground">
              PPE with Prof Matt or Geography with Dr River.
            </span>
          </li>
          <li className="rounded-md border bg-card p-3">
            <span className="font-medium">2. Talk.</span>{" "}
            <span className="text-muted-foreground">
              Up to {INTERVIEW_MINUTES} minutes, out loud, with a chart to reason about.
            </span>
          </li>
          <li className="rounded-md border bg-card p-3">
            <span className="font-medium">3. Get your letter.</span>{" "}
            <span className="text-muted-foreground">
              Your tutor writes back on where your reasoning held and where it slipped.
            </span>
          </li>
        </ol>
      </main>
      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Not affiliated with Oxford or Cambridge. AI can make mistakes.
      </footer>
    </div>
  );
}
