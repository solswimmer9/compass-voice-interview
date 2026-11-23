import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  hasChosenSubject,
  parseInterviewChoice,
  takeChoiceAfterSignIn,
} from "@/lib/interview-choice";
import { MeridianPage, Rose, mono, serif } from "@/components/meridian/MeridianFrame";
import { INTERVIEW_MINUTES, OBJECT_REVEAL_MINUTES } from "@/lib/limits";
import { FREE_INTERVIEWS } from "@/lib/offer";
import { SUBJECTS } from "@/lib/subjects";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import graduate from "@/assets/home/graduate.webp";
import blackboard from "@/assets/home/blackboard.webp";
import reader from "@/assets/home/reader.webp";
import writer from "@/assets/home/writer.webp";
import caps from "@/assets/home/caps.webp";
import maths from "@/assets/home/maths.webp";
import medicine from "@/assets/home/medicine.webp";

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
      { title: "Compass · Education, grounded in context" },
      {
        name: "description",
        content:
          "Practise your Oxbridge interview out loud with an AI tutor who challenges your reasoning, then read their feedback letter.",
      },
      { property: "og:title", content: "Compass · Education, grounded in context" },
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

const hairline = "border-[#d6d6d2]";

function SketchCard({
  src,
  alt,
  className,
  bob,
  height,
}: {
  src: string;
  alt: string;
  className: string;
  bob: string;
  height: number;
}) {
  return (
    <div className={className}>
      <div
        className={`${bob} rounded-xl bg-white p-2.5 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.35)]`}
      >
        <img
          src={src}
          alt={alt}
          style={{ height }}
          className="block w-full rounded-md object-cover grayscale"
        />
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Pick a subject",
    body: "PPE with Prof Matt, Geography with Dr River or Biology with Dr Toby.",
    img: writer,
    alt: "Sketch of a student writing",
    blend: true,
  },
  {
    n: "02",
    title: "Talk it through",
    body: `Up to ${INTERVIEW_MINUTES} minutes, out loud, with a chart to reason about around minute ${OBJECT_REVEAL_MINUTES}.`,
    img: blackboard,
    alt: "Sketch of a student working an equation at a blackboard",
    blend: false,
  },
  {
    n: "03",
    title: "Read your letter",
    body: "Every subject ends with a letter from your tutor on where your reasoning held and where it slipped.",
    img: reader,
    alt: "Sketch of a student reading",
    blend: false,
  },
];

const COMING_SOON: { subject: string; tutor: string; line: string; img: string; alt: string }[] = [
  {
    subject: "Maths",
    tutor: "Prof Hannah",
    line: "Proofs, puzzles and the step you cannot skip, worked through out loud at the board.",
    img: maths,
    alt: "Sketch of a student writing equations on a blackboard",
  },
  {
    subject: "Medicine",
    tutor: "Dr Anna",
    line: "Ethics, evidence and the patient in front of you, reasoned through out loud.",
    img: medicine,
    alt: "Sketch of a doctor carrying books down a corridor",
  },
];

const FAQS = [
  {
    q: "Is Compass part of Oxford or Cambridge?",
    a: "No. Compass was built by Cambridge students but is not affiliated with either university. The tutors are AI, and AI can make mistakes.",
  },
  {
    q: "How long is an interview?",
    a: `Up to ${INTERVIEW_MINUTES} minutes, spoken out loud in your browser. Around minute ${OBJECT_REVEAL_MINUTES} your tutor puts a chart in front of you to reason about.`,
  },
  {
    q: "What do I get afterwards?",
    a: "A letter from your tutor on where your reasoning held and where it slipped, quoting what you actually said.",
  },
  {
    q: "Can I trust the feedback?",
    a: "Your tutor's letter quotes what you said, so you can check its points against your own words. Before you see it, any line that quotes words you did not say is removed. It is practice feedback, not a mark or a prediction, and AI can make mistakes. Use it alongside advice from your teachers.",
  },
  {
    q: "Does practising with Compass count as cheating?",
    a: "Compass is practice, like a mock interview with a teacher or a friend. We are not affiliated with Oxford or Cambridge, and we don't claim either university endorses it. If you want a college's view on interview preparation, ask them directly.",
  },
  {
    q: "Is this fair for students who can't afford coaching?",
    a: "Private coaching is expensive and not everyone can get it. Compass is meant to make interview practice available to more students, and schools can buy a bundle of interviews for their sixth form. Teachers see how many places are left, never a student's transcript or letter. It is one way to practise, not a replacement for a teacher's mock interview.",
  },
  {
    q: "Can my school buy places for students?",
    a: "Yes. A school buys a bundle and each student claims a place with their own account. Teachers do not see students' transcripts or letters.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-[880px]">
      <h2 id="questions" className={`reveal ${serif} mb-8 text-[clamp(36px,4vw,56px)]`}>
        Questions
      </h2>
      <div className="border-t border-[#cfcfcb]">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="border-b border-[#cfcfcb]">
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className={`${serif} flex w-full items-center justify-between gap-5 px-2 py-5 text-left text-[26px] text-[#161616] transition-colors hover:bg-white`}
                >
                  {f.q}
                  <span aria-hidden="true" className={`${mono} text-base text-[#5a5a57]`}>
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
              </h3>
              {isOpen && (
                <p
                  id={`faq-${i}`}
                  className="max-w-[680px] px-2 pb-6 text-[15px] leading-[1.7] text-[#4a4a48]"
                >
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
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

  const cell = `cell border-b border-r ${hairline} px-[18px] py-6 text-sm`;

  return (
    <MeridianPage
      framed={
        <>
          <section className="px-4 pb-20 pt-2.5 text-center sm:px-8">
            <div className="relative h-[350px] overflow-hidden sm:h-[560px]">
              <div className="rose-stage absolute left-1/2 top-0 -ml-[450px] h-[560px] w-[900px]">
                <Rose />
                <SketchCard
                  src={blackboard}
                  alt="Sketch of a student working an equation on a blackboard"
                  className="fan-l absolute left-1/2 top-[130px] -ml-[300px] w-[220px]"
                  bob="bob-2"
                  height={220}
                />
                <SketchCard
                  src={reader}
                  alt="Sketch of a student reading at a desk"
                  className="fan-r absolute left-1/2 top-[130px] ml-[80px] w-[220px]"
                  bob="bob-3"
                  height={220}
                />
                <SketchCard
                  src={graduate}
                  alt="Sketch of a graduate in cap and gown"
                  className="fan-c absolute left-1/2 top-[100px] z-[2] -ml-[125px] w-[250px]"
                  bob="bob"
                  height={270}
                />
              </div>
            </div>
            <h1
              className={`rise ${serif} m-0 text-[clamp(44px,6.4vw,96px)] leading-[0.98] tracking-[-0.02em]`}
              style={{ animationDelay: "0.5s" }}
            >
              Education, grounded in context.
              <br />
              <em>Potential, released.</em>
            </h1>
            <p
              className="rise mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-[#4a4a48]"
              style={{ animationDelay: "0.65s" }}
            >
              Spoken Oxbridge interview practice, built by Cambridge students. Talk for up to{" "}
              {INTERVIEW_MINUTES} minutes with a tutor who follows your reasoning, then read their
              letter.
            </p>
            <div
              className={`mx-auto mt-11 grid max-w-[720px] grid-cols-1 border-l border-t text-left sm:grid-cols-3 ${hairline}`}
            >
              {SUBJECTS.map((s, i) => (
                <Link
                  key={s.id}
                  to="/interview"
                  search={{ tutor: s.id, start: true as const }}
                  className={`${cell} flex justify-between`}
                  style={{ animationDelay: `${0.7 + i * 0.08}s` }}
                >
                  <span>
                    {s.name} · {s.tutor}
                  </span>
                  <span className="arr" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
              {[
                `${INTERVIEW_MINUTES} MIN · SPOKEN`,
                `CHART · MINUTE ${OBJECT_REVEAL_MINUTES}`,
                "LETTER · AFTER",
              ].map((label, i) => (
                <div
                  key={label}
                  className={`${cell} ${mono} text-xs text-[#4a4a48]`}
                  style={{ animationDelay: `${0.94 + i * 0.08}s` }}
                >
                  {label}
                </div>
              ))}
            </div>
          </section>
        </>
      }
    >
      {/* 2. How it works: three sketch cards. */}
      <section className="px-2 pb-10 pt-28">
        <p className={`${mono} text-xs text-[#5a5a57]`}>HOW IT WORKS</p>
        <h2
          className={`reveal ${serif} mb-14 mt-3.5 max-w-[760px] text-[clamp(38px,4.6vw,66px)] leading-none tracking-[-0.02em]`}
        >
          {INTERVIEW_MINUTES} minutes, out loud, with someone who will not let a lazy answer pass.
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="lift reveal rounded-[14px] bg-[#f7f7f5] p-3.5 pb-7">
              <img
                src={step.img}
                alt={step.alt}
                className={`block h-[250px] w-full rounded-lg object-cover grayscale ${step.blend ? "mix-blend-multiply" : ""}`}
              />
              <p className={`${mono} mx-2.5 mb-1.5 mt-5 text-xs text-[#5a5a57]`}>{step.n}</p>
              <h3 className={`${serif} mx-2.5 text-[32px]`}>{step.title}</h3>
              <p className="mx-2.5 mt-2 text-[15px] leading-relaxed text-[#4a4a48]">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Coming soon: the next tutors. */}
      <section className="px-2 py-20">
        <p className={`${mono} text-xs text-[#5a5a57]`}>COMING SOON</p>
        <h2
          className={`reveal ${serif} mb-12 mt-3.5 text-[clamp(38px,4.6vw,66px)] leading-none tracking-[-0.02em]`}
        >
          Two more tutors, <em>on their way.</em>
        </h2>
        <ul className="grid gap-6 sm:grid-cols-2">
          {COMING_SOON.map((t) => (
            <li key={t.subject} className="lift reveal rounded-[14px] bg-[#f7f7f5] p-3.5 pb-7">
              <div className="relative h-[280px] overflow-hidden rounded-lg">
                <img
                  src={t.img}
                  alt={t.alt}
                  className="mx-auto block h-full mix-blend-multiply grayscale"
                />
              </div>
              <p className={`${mono} mx-2.5 mb-1.5 mt-5 text-xs text-[#5a5a57]`}>
                {t.subject.toUpperCase()} · COMING SOON
              </p>
              <h3 className={`${serif} mx-2.5 text-[32px]`}>{t.tutor}</h3>
              <p className="mx-2.5 mt-2 text-[15px] leading-relaxed text-[#4a4a48]">{t.line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. The letter. */}
      <section className="flex flex-wrap items-center gap-12 px-2 py-20">
        <div className="reveal flex-[1_1_420px] rounded-[14px] bg-[#f7f7f5] p-6">
          <img
            src={caps}
            alt="Sketch of graduates throwing their caps into the air"
            className="block w-full mix-blend-multiply grayscale"
          />
        </div>
        <div className="flex-[1_1_420px]">
          <h2
            className={`reveal ${serif} text-[clamp(40px,4.6vw,68px)] leading-none tracking-[-0.02em]`}
          >
            The interview is the practice.
            <br />
            <em>The letter is the lesson.</em>
          </h2>
          <Link
            to="/subjects"
            className="group mt-9 inline-flex items-center gap-4 rounded-full bg-[#161616] py-3 pl-6 pr-3 sm:gap-5 sm:pl-7 text-[#f7f7f5] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 hover:bg-[#2a2a2a]"
          >
            <span className="text-left">
              <span className={`${serif} block text-[26px] leading-tight`}>
                Start your interview
              </span>
              <span
                className={`${mono} block whitespace-nowrap text-[10px] text-[#bdbdb8] sm:text-[11px]`}
              >
                FIRST {FREE_INTERVIEWS} FREE · {INTERVIEW_MINUTES} MIN · LETTER AFTER
              </span>
            </span>
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-[#f7f7f5] text-xl text-[#161616] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </section>

      {/* 4. Directory and questions. */}
      <section className="px-2 pb-28 pt-20">
        <div className="mb-4 grid border-l border-t border-[#cfcfcb] sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { label: "MEET THE TUTORS", title: "Prof Matt, Dr River & Dr Toby", to: "/subjects" },
              { label: "SUBJECTS", title: "PPE, Geography & Biology", to: "/subjects" },
              { label: "APPLICANTS", title: "Pricing and access", to: "/pricing" },
              { label: "SCHOOLS", title: "Places for your sixth form", to: "/schools" },
            ] as const
          ).map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              className="cell block border-b border-r border-[#cfcfcb] px-[22px] pb-8 pt-7"
            >
              <span className={`${mono} block text-[11px] text-[#5a5a57]`}>{tile.label}</span>
              <span className={`${serif} mt-2 block text-[30px]`}>{tile.title}</span>
            </Link>
          ))}
        </div>
        <p className="mb-24 px-2 text-[15px] leading-relaxed text-[#4a4a48]">
          <Link to="/schools" className="underline underline-offset-4">
            Teachers: give your sixth form interview practice without seeing anyone's report.
          </Link>
        </p>
        <Faq />
      </section>
    </MeridianPage>
  );
}
