import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  hasChosenSubject,
  parseInterviewChoice,
  takeChoiceAfterSignIn,
} from "@/lib/interview-choice";
import { FlippingWord } from "@/components/FlippingWord";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { INTERVIEW_MINUTES, OBJECT_REVEAL_MINUTES } from "@/lib/limits";
import { SUBJECTS } from "@/lib/subjects";
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

function WordSculpture() {
  // Heavy vector lettering: charcoal-to-white-to-silver fill, a duplicate offset downward for
  // extrusion, a fine white upper-edge highlight and a restrained pale-cyan rim light.
  const text = {
    x: "50%",
    y: "74%",
    textAnchor: "middle" as const,
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: 330,
    letterSpacing: -14,
  };
  return (
    <svg viewBox="0 0 1200 400" aria-hidden="true" className="absolute inset-x-0 top-0 w-full">
      <defs>
        <linearGradient id="sculpture-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3d" />
          <stop offset="0.38" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#c9ccd1" />
          <stop offset="1" stopColor="#6e6e73" />
        </linearGradient>
        <filter id="rim" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <text {...text} fill="#7fd6ff" opacity="0.5" filter="url(#rim)">
        TALK
      </text>
      <text {...text} dy="14" fill="#1d1d1f">
        TALK
      </text>
      <text {...text} className="sculpture-letters">
        TALK
      </text>
      <text {...text} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2">
        TALK
      </text>
    </svg>
  );
}

/** One isolated interface plane: the live caption as the tutor speaks. */
function InterfacePlane() {
  const bars = [14, 28, 44, 30, 56, 38, 22, 48, 32, 18, 40, 26];
  return (
    <div
      className="absolute bottom-0 left-1/2 z-10 w-[min(440px,86vw)] -translate-x-1/2 rounded-[28px] border border-white/10 bg-[#161617]/90 p-8 shadow-[0_40px_120px_rgba(41,151,255,0.18)] backdrop-blur-xl"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between text-[14px] text-[#86868b]">
        <span>Prof Matt</span>
        <span className="flex items-center gap-2">
          <span className="live-pulse size-2 rounded-full bg-[#2997ff]" />
          Live
        </span>
      </div>
      <p className="mt-6 text-[21px] font-semibold leading-[1.3] tracking-[0.011em] text-[#f5f5f7]">
        Why would a fair price be one the buyer would{" "}
        <span className="text-[#86868b]">also choose?</span>
      </p>
      <div className="mt-8 flex h-14 items-end gap-1.5">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: h }}
            className="w-full rounded-full bg-gradient-to-t from-[#0071e3] to-[#9fd8ff]"
          />
        ))}
      </div>
    </div>
  );
}

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
    <div className="surface-stage min-h-[100svh]">
      {/* 1. Sculptural opening: object stage, then identity and action anchored below. */}
      <header className="relative flex min-h-[100svh] flex-col overflow-hidden">
        <SiteNav />
        <div className="relative mx-auto mt-10 min-h-[420px] w-full max-w-[1200px] flex-1 sm:min-h-0 sm:flex-none sm:aspect-[1200/520]">
          <WordSculpture />
          <InterfacePlane />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-[1260px] flex-col items-start justify-between gap-8 px-6 pb-14 sm:px-[90px] lg:flex-row lg:items-end">
          <div>
            <p className="text-[32px] font-semibold leading-[1.125] tracking-[0.004em]">Compass</p>
            <h1
              aria-label="We are here to democratise Oxbridge"
              className="t-promise mt-2 max-w-[11ch] sm:max-w-none"
            >
              Say it out loud.
            </h1>
            <p className="mt-3 text-[17px] text-[#86868b]">
              We are here to <FlippingWord words={HEADLINE_WORDS} /> Oxbridge.
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-[28px] bg-[#161617] p-5">
            <div className="text-[14px] leading-[1.286] tracking-[-0.016em]">
              <p className="font-semibold">Up to {INTERVIEW_MINUTES} minutes</p>
              <p className="text-[#86868b]">Voice interview and a feedback letter</p>
            </div>
            <Link to="/subjects" className="btn-pill">
              Start practising
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Chapter statement. */}
      <section className="mx-auto max-w-[840px] px-6 py-24 text-center sm:py-36">
        <p className="t-eyebrow text-[#86868b]">The interview</p>
        <h2 className="t-display mt-5">Think out loud. Be heard.</h2>
        <p className="t-lead mt-6 text-[#86868b]">
          Built by Cambridge students for applicants, based on real context.{" "}
          <span className="text-[#f5f5f7]">
            Practise with an AI tutor who challenges your reasoning like a real interviewer.
          </span>
        </p>
        <div className="mt-8 flex items-center justify-center gap-6">
          <Link to="/subjects" className="btn-pill">
            Pick a subject
          </Link>
          <Link to="/readings" search={{ subject: "ppe" }} className="text-action">
            Start with a reading ›
          </Link>
        </div>
      </section>

      {/* 3. Material reveal: one oversized detail, lit from the dark. */}
      <section className="surface-charcoal py-24 sm:py-36">
        <div className="mx-auto max-w-[1260px] px-6 sm:px-[90px]">
          <p className="t-eyebrow text-[#86868b]">Your reasoning</p>
          <h2 className="gradient-sweep t-display mt-5 max-w-[14ch]">
            Then a chart lands on the table.
          </h2>
          <p className="t-lead mt-6 max-w-[840px] text-[#86868b]">
            Around minute {OBJECT_REVEAL_MINUTES}, your tutor puts a chart in front of you.{" "}
            <span className="text-[#f5f5f7]">
              Read it, reason about it, and defend what you see.
            </span>
          </p>
          <div className="tile-black mt-16 border border-[#333336] p-8 sm:p-14">
            <svg
              viewBox="0 0 800 300"
              role="img"
              aria-label="A chart to reason about"
              className="w-full"
            >
              <defs>
                <linearGradient id="line" x1="0" x2="1">
                  <stop offset="0" stopColor="#9fd8ff" />
                  <stop offset="1" stopColor="#0071e3" />
                </linearGradient>
              </defs>
              {[60, 120, 180, 240].map((y) => (
                <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="#333336" />
              ))}
              <path
                d="M0 240 C120 230 180 200 260 190 S420 120 500 110 S680 40 800 30"
                fill="none"
                stroke="url(#line)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="500" cy="110" r="10" fill="#fff" />
              <circle cx="500" cy="110" r="22" fill="none" stroke="#2997ff" strokeOpacity="0.6" />
            </svg>
          </div>
        </div>
      </section>

      {/* 4. Proof: one claim per tile, figures alternating with a fragment. */}
      <section className="py-24 sm:py-36">
        <div className="mx-auto max-w-[1260px] px-6 sm:px-[90px]">
          <div className="rounded-[28px] bg-[#1d1d1f] px-6 pb-16 pt-12 sm:px-10 sm:pb-[120px] sm:pt-[72px]">
            <h2 className="text-[40px] font-semibold leading-[1.07] tracking-[-0.005em] sm:text-[56px]">
              How it works.
            </h2>
            <ol className="mx-auto mt-12 grid max-w-[1050px] gap-5 sm:grid-cols-3">
              {[
                ["1", "Pick a subject.", "PPE with Prof Matt or Geography with Dr River."],
                [
                  "2",
                  "Talk.",
                  `Up to ${INTERVIEW_MINUTES} minutes, out loud, with a chart to reason about.`,
                ],
                [
                  "3",
                  "Get your letter.",
                  "Your tutor writes back on where your reasoning held and where it slipped.",
                ],
              ].map(([n, title, body]) => (
                <li
                  key={n}
                  className="tile-black flex min-h-[300px] flex-col items-center justify-center p-8 text-center"
                >
                  <span className="text-[48px] font-semibold leading-[1.083] tracking-[-0.003em]">
                    {n}
                  </span>
                  <span className="mt-3 text-[17px] font-semibold">{title}</span>
                  <span className="mt-1 text-[14px] leading-[1.43] text-[#86868b]">{body}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 5. Light retail resolution: choose a subject. */}
      <section className="surface-light on-light py-24 sm:py-36">
        <div className="mx-auto max-w-[1260px] px-6 sm:px-[90px]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-heading">Choose your tutor.</h2>
            <Link to="/pricing" className="text-action">
              See pricing ›
            </Link>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2">
            {SUBJECTS.map((s) => (
              <li key={s.id} className="card-white flex min-h-[380px] flex-col p-8">
                <span className="text-[14px] font-semibold text-[#6e6e73]">with {s.tutor}</span>
                <span className="t-card-heading mt-2">{s.name}</span>
                <span className="mt-3 flex-1 text-[17px] leading-[1.235] tracking-[-0.022em] text-[#6e6e73]">
                  {s.line}
                </span>
                <Link
                  to="/interview"
                  search={{ tutor: s.id, start: true as const }}
                  className="btn-pill mt-8 self-start"
                >
                  Start interview
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
