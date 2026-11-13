import { createFileRoute, Link } from "@tanstack/react-router";
import { readingById } from "@/lib/readings";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { AssessPanel } from "@/components/AssessPanel";
import { FlippingWord } from "@/components/FlippingWord";
import { LiveRoom } from "@/components/LiveRoom";
import { tutorKey } from "@/lib/tutor-theme";
import { DotPattern } from "@/components/ui/dot-pattern";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { isPreviewBrowser } from "@/lib/preview";

const HEADLINE_WORDS = ["democratise", "open up", "demystify", "widen access to"];

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { reading?: string; tutor?: "ppe"; mode?: "object" } => ({
    ...(typeof search["reading"] === "string" ? { reading: search["reading"] } : {}),
    // PPE with Prof Matt. Uses an interview credit like geography (none for tester accounts).
    ...(search["tutor"] === "ppe" ? { tutor: "ppe" as const } : {}),
    // Object interview: the tutor puts an unlabelled chart on the table. The server decides
    // which object (approved only for students) and refuses before any credit if none exists.
    ...(search["mode"] === "object" ? { mode: "object" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "We are here to democratise Oxbridge" },
      {
        name: "description",
        content:
          "A voice tutor asks Cambridge-style geography questions and challenges your reasoning like a real interviewer.",
      },
      { property: "og:title", content: "We are here to democratise Oxbridge" },
      {
        property: "og:description",
        content: "Practise your Oxbridge geography interview out loud, then replay the transcript.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** What the browser is shown of an object interview. The tutor's notes never reach it. */
type TableObject = { objectId: string; svg: string; alt: string; caption: string };

function tableObjectFrom(event: LiveEvent): TableObject | null {
  const { objectId, svg, alt, caption } = event;
  if (typeof objectId !== "string" || typeof svg !== "string" || !svg.startsWith("<svg")) {
    return null;
  }
  return {
    objectId,
    svg,
    alt: typeof alt === "string" ? alt : "An unlabelled chart",
    caption: typeof caption === "string" ? caption : "Your tutor has put this on the table",
  };
}

function ObjectCard({ object }: { object: TableObject }) {
  // Drawn as an image, so the SVG cannot run scripts or pick up page styles.
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(object.svg)}`;
  return (
    <figure className="rounded-md border bg-card p-4 sm:p-5">
      <figcaption className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        {object.caption}
      </figcaption>
      <img src={src} alt={object.alt} className="mt-4 block h-auto w-full" />
    </figure>
  );
}

type Fragment = { text: string; start: number; end: number; sequence: number };
type Line = {
  role: "user" | "assistant";
  text: string;
  start: number;
  end: number;
  fragments: Fragment[];
};

function appendTranscriptFragment(lines: Line[], role: Line["role"], fragment: Fragment): Line[] {
  const next = [...lines];
  let index = -1;
  for (let candidate = next.length - 1; candidate >= 0; candidate--) {
    const line = next[candidate]!;
    if (
      line.role === role &&
      fragment.start <= line.end + 500 &&
      fragment.end >= line.start - 500
    ) {
      index = candidate;
      break;
    }
  }
  if (index < 0 && next.at(-1)?.role === role) index = next.length - 1;
  if (index < 0) {
    return [
      ...next,
      {
        role,
        text: fragment.text,
        start: fragment.start,
        end: fragment.end,
        fragments: [fragment],
      },
    ];
  }
  const line = next[index]!;
  const fragments = [...line.fragments, fragment].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.sequence - b.sequence,
  );
  next[index] = {
    ...line,
    start: Math.min(line.start, fragment.start),
    end: Math.max(line.end, fragment.end),
    fragments,
    text: fragments.map((part) => part.text).join(""),
  };
  return next;
}

function Index() {
  return <InterviewPage />;
}

function InterviewPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fragmentSequence = useRef(0);

  const [cardIds, setCardIds] = useState<string[]>([]);
  const [tableObject, setTableObject] = useState<TableObject | null>(null);
  const onEvent = useCallback((event: LiveEvent) => {
    if (event.type === "app.interview.object") {
      setTableObject(tableObjectFrom(event));
      return;
    }
    if (event.type === "app.interview.started") {
      const ids = Array.isArray(event["cardIds"]) ? event["cardIds"] : [];
      setCardIds(ids.filter((id): id is string => typeof id === "string"));
      return;
    }
    if (
      (event.type !== "session.input_transcript.delta" &&
        event.type !== "session.output_transcript.delta") ||
      typeof event.delta !== "string" ||
      event.delta.length === 0
    ) {
      return;
    }
    const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
    const fragment = {
      text: event.delta,
      start: typeof event.start_ms === "number" ? event.start_ms : 0,
      end: typeof event.end_ms === "number" ? event.end_ms : 0,
      sequence: ++fragmentSequence.current,
    };
    setLines((previous) => appendTranscriptFragment(previous, role, fragment));
  }, []);

  const { reading: readingParam, tutor: tutorParam, mode } = Route.useSearch();
  const ppe = tutorParam === "ppe";
  const objectMode = mode === "object";
  // Practice readings are geography articles, so PPE and object interviews ignore them.
  const reading = ppe || objectMode ? undefined : readingById(readingParam);
  const tutorName = ppe ? "Prof Matt" : "Dr River";
  const getStartContext = useCallback(async () => {
    const environment = getPaymentsEnvironment();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Please sign in again before starting your interview.");
    const objectRequest = objectMode ? { mode: "object" as const } : {};
    if (ppe) return { accessToken, environment, tutorId: "ppe" as const, ...objectRequest };
    return {
      accessToken,
      environment,
      ...objectRequest,
      ...(reading ? { readingId: reading.id } : {}),
    };
  }, [reading, ppe, objectMode]);
  const call = useLiveVoice({ onEvent, getStartContext });
  const account = useAccountSnapshot();
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(isPreviewBrowser()), []);
  const idle = call.status === "idle" || call.status === "closed";

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (call.status !== "connected") return;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [call.status]);
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  const start = () => {
    setLines([]);
    setCardIds([]);
    setTableObject(null);
    fragmentSequence.current = 0;
    call.start();
  };

  const interviewId = call.interviewId;
  const refetchAccount = account.refetch;
  useEffect(() => {
    if (interviewId && interviewId !== "preview") void refetchAccount();
  }, [interviewId, refetchAccount]);

  // Also true after a dropped call, so an interview that ended early can still be assessed.
  const showReplay = idle && lines.length > 0;

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      {/* Always mounted, so the tutor's voice keeps playing as the page switches views. */}
      <audio ref={call.audioRef} controls className="hidden" playsInline />
      {idle ? (
        <>
          <nav className="relative z-20 mx-auto flex max-w-2xl items-center justify-end gap-5 px-6 pt-6 text-sm">
            <Link to="/tutors" className="text-muted-foreground transition hover:text-foreground">
              Subjects
            </Link>
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
          <main
            className={`relative z-10 mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-6 py-16 ${tableObject ? "lg:max-w-4xl" : ""}`}
          >
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                {ppe ? "Oxford-style practice · PPE" : "Oxbridge practice · Geography"}
              </p>
              <h1
                aria-label="We are here to democratise Oxbridge"
                className="mt-4 text-4xl font-medium leading-tight tracking-tighter sm:text-6xl"
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
                  Preparing for an Oxbridge interview has been too hard for too long. We change
                  that.
                </p>
                {ppe ? (
                  <p className="mt-2 text-foreground/90">
                    Practise out loud with Prof Matt, an AI tutor for Oxford-style Philosophy,
                    Politics and Economics, who will test your premises and push on your arguments.
                  </p>
                ) : (
                  <p className="mt-2 text-foreground/90">
                    Practise out loud with Dr River, an AI tutor informed by real Cambridge
                    geography notes, who will challenge your reasoning.
                  </p>
                )}
              </div>
              <ol className="mt-8 grid gap-3 text-left text-sm sm:grid-cols-3">
                <li className="rounded-md border bg-card p-3">
                  <span className="font-medium">1. Talk.</span>{" "}
                  <span className="text-muted-foreground">
                    Up to {INTERVIEW_MINUTES} minutes, using your microphone.
                  </span>
                </li>
                <li className="rounded-md border bg-card p-3">
                  <span className="font-medium">2. Read back.</span>{" "}
                  <span className="text-muted-foreground">
                    See the transcript of how you argued.
                  </span>
                </li>
                <li className="rounded-md border bg-card p-3">
                  <span className="font-medium">3. Get feedback.</span>{" "}
                  <span className="text-muted-foreground">
                    Find out where your reasoning slipped.
                  </span>
                </li>
              </ol>
            </div>

            {idle && (
              <p className="mt-6 text-center text-sm">
                <span className="font-medium">
                  {ppe ? "PPE · Prof Matt" : "Geography · Dr River"}
                </span>
                <span className="text-muted-foreground"> · </span>
                <Link to="/tutors" className="text-muted-foreground underline">
                  Change subject
                </Link>
              </p>
            )}
            {objectMode && idle && (
              <p className="mt-6 rounded-md border border-accent/60 px-4 py-3 text-center text-sm">
                Object interview: {tutorName} puts an unlabelled chart on the table and asks what it
                could be.{" "}
                <Link
                  to="/"
                  search={ppe ? { tutor: "ppe" } : {}}
                  className="text-muted-foreground underline"
                >
                  Switch to a normal interview
                </Link>
              </p>
            )}
            {reading && (
              <p className="mt-6 rounded-md border border-accent/60 px-4 py-3 text-center text-sm">
                Reading interview: <span className="font-medium">{reading.title}</span>.{" "}
                <Link to="/" search={{}} className="text-muted-foreground underline">
                  Switch to a normal interview
                </Link>
              </p>
            )}
            <div
              className={
                tableObject ? "mt-6 grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start" : "contents"
              }
            >
              {tableObject && <ObjectCard object={tableObject} />}
              <section className={`${tableObject ? "" : "mt-6 "}rounded-md border bg-card p-6`}>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {!account.user ? (
                    <Link
                      to="/auth"
                      search={{
                        ...(ppe ? { tutor: "ppe" as const } : {}),
                        ...(objectMode ? { mode: "object" as const } : {}),
                      }}
                      className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
                    >
                      Sign in to start
                    </Link>
                  ) : !preview && account.data?.totalRemaining === 0 ? (
                    <Link
                      to="/pricing"
                      className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
                    >
                      Get more interviews
                    </Link>
                  ) : (
                    <button
                      onClick={start}
                      disabled={!preview && account.loading}
                      className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                    >
                      {showReplay ? "Start a new interview" : "Start interview"}
                    </button>
                  )}
                </div>
                {call.playbackBlocked && (
                  <button
                    onClick={call.resumePlayback}
                    className="mx-auto mt-3 block rounded-full border px-4 py-2 text-sm"
                  >
                    Play {tutorName}’s voice
                  </button>
                )}
                {preview ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Tester mode · unlimited
                  </p>
                ) : (
                  account.user &&
                  account.data && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {account.data.lifetime ? (
                        "Lifetime access · unlimited interviews"
                      ) : (
                        <>
                          {account.data.totalRemaining}{" "}
                          {account.data.totalRemaining === 1 ? "interview" : "interviews"} remaining
                          · {account.data.freeRemaining} free · {account.data.paidRemaining}{" "}
                          purchased
                        </>
                      )}
                    </p>
                  )
                )}
                {call.error && (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {call.error}
                  </p>
                )}
              </section>
            </div>

            {lines.length > 0 && (
              <section className="mt-10">
                <h2 className="font-serif text-3xl font-semibold">
                  {showReplay ? "Replay" : "Transcript"}
                </h2>
                {showReplay && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read back how you argued. Where did {tutorName} push hardest?
                  </p>
                )}
                <ol className="mt-6 space-y-5">
                  {lines.map((line, i) => (
                    <li
                      key={i}
                      className={
                        line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"
                      }
                    >
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {line.role === "assistant" ? tutorName : "You"}
                      </p>
                      <p
                        className={
                          line.role === "assistant" ? "mt-1 font-serif text-xl italic" : "mt-1"
                        }
                      >
                        {line.text}
                      </p>
                    </li>
                  ))}
                </ol>
                <div ref={endRef} />
              </section>
            )}

            {showReplay && (
              <AssessPanel
                interviewId={call.interviewId}
                studentName={account.data?.profile?.display_name}
                {...(ppe ? { tutorId: "ppe" as const, cardIds } : {})}
                {...(tableObject ? { objectId: tableObject.objectId } : {})}
                initialTranscript={lines
                  .map((l) => `${l.role === "assistant" ? tutorName : "You"}: ${l.text.trim()}`)
                  .join("\n\n")}
              />
            )}
          </main>
          <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
            Not affiliated with Oxford or Cambridge. AI can make mistakes.
          </footer>
        </>
      ) : (
        call.status !== "idle" &&
        call.status !== "closed" && (
          <LiveRoom
            tutor={tutorKey(ppe ? "ppe" : undefined)}
            tutorName={tutorName}
            subjectLabel={ppe ? "PPE · Prof Matt" : "Geography · Dr River"}
            objectMode={objectMode}
            object={tableObject ? <ObjectCard object={tableObject} /> : undefined}
            status={call.status}
            audioRef={call.audioRef}
            line={lines.length ? { ...lines.at(-1)!, key: lines.length } : undefined}
            clock={`${clock(Math.min(elapsed, INTERVIEW_MINUTES * 60))} / ${INTERVIEW_MINUTES}:00`}
            muted={call.muted}
            onToggleMute={() => call.setMuted(!call.muted)}
            onEnd={call.stop}
            playbackBlocked={call.playbackBlocked}
            onResumePlayback={call.resumePlayback}
            error={call.error}
          />
        )
      )}
    </div>
  );
}
