import { createFileRoute, Link } from "@tanstack/react-router";
import { readingById } from "@/lib/readings";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { AssessPanel } from "@/components/AssessPanel";
import { FlippingWord } from "@/components/FlippingWord";
import { DotPattern } from "@/components/ui/dot-pattern";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { isPreviewBrowser } from "@/lib/preview";
import {
  appendTranscriptFragment,
  buildResumeRecap,
  formatTranscript,
  type TranscriptLine,
} from "@/lib/transcript";

const HEADLINE_WORDS = ["democratise", "open up", "demystify", "widen access to"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { reading?: string } =>
    typeof search["reading"] === "string" ? { reading: search["reading"] } : {},
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

function Index() {
  return <InterviewPage />;
}

function InterviewPage() {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fragmentSequence = useRef(0);
  // Each reconnect starts a new voice session whose timings restart from zero.
  const transcriptSegment = useRef(0);

  const onEvent = useCallback((event: LiveEvent) => {
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
      segment: transcriptSegment.current,
    };
    setLines((previous) => appendTranscriptFragment(previous, role, fragment));
  }, []);

  const { reading: readingParam } = Route.useSearch();
  const reading = readingById(readingParam);
  const getStartContext = useCallback(async () => {
    const environment = getPaymentsEnvironment();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Please sign in again before starting your interview.");
    return { accessToken, environment, ...(reading ? { readingId: reading.id } : {}) };
  }, [reading]);
  const call = useLiveVoice({ onEvent, getStartContext });
  const account = useAccountSnapshot();
  const [preview, setPreview] = useState(false);
  useEffect(() => setPreview(isPreviewBrowser()), []);
  const idle = call.status === "idle" || call.status === "closed";

  const limitSeconds = INTERVIEW_MINUTES * 60;
  const endsAt = call.endsAt;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (call.status !== "connected") return;
    const startedAt = Date.now();
    // Prefer the server's deadline, which also covers a resumed interview.
    const tick = () =>
      setElapsed(
        endsAt === null
          ? Math.floor((Date.now() - startedAt) / 1000)
          : limitSeconds - Math.ceil(Math.max(0, endsAt - Date.now()) / 1000),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.status, endsAt, limitSeconds]);
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  const start = () => {
    setLines([]);
    fragmentSequence.current = 0;
    transcriptSegment.current = 0;
    call.start();
  };

  const canReconnect =
    call.status === "closed" && call.ending === "dropped" && Boolean(call.interviewId);
  const reconnect = () => {
    // Earlier lines stay; new ones are appended as a separate segment.
    transcriptSegment.current += 1;
    call.reconnect(buildResumeRecap(lines));
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
      <nav className="relative z-20 mx-auto flex max-w-2xl items-center justify-end gap-5 px-6 pt-6 text-sm">
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
      <main className="relative z-10 mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Oxbridge practice · Geography
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
              Preparing for an Oxbridge interview has been too hard for too long. We change that.
            </p>
            <p className="mt-2 text-foreground/90">
              Practise out loud with Dr River, an AI tutor informed by real Cambridge geography
              notes, who will challenge your reasoning.
            </p>
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
              <span className="text-muted-foreground">See the transcript of how you argued.</span>
            </li>
            <li className="rounded-md border bg-card p-3">
              <span className="font-medium">3. Get feedback.</span>{" "}
              <span className="text-muted-foreground">Find out where your reasoning slipped.</span>
            </li>
          </ol>
        </div>

        {reading && (
          <p className="mt-6 rounded-md border border-accent/60 px-4 py-3 text-center text-sm">
            Reading interview: <span className="font-medium">{reading.title}</span>.{" "}
            <Link to="/" search={{}} className="text-muted-foreground underline">
              Switch to a normal interview
            </Link>
          </p>
        )}
        <section className="mt-6 rounded-md border bg-card p-6">
          <audio ref={call.audioRef} controls className="hidden" playsInline />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {idle ? (
              canReconnect ? (
                <>
                  <button
                    onClick={reconnect}
                    className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={call.dismissReconnect}
                    className="rounded-full border px-6 py-3 font-medium"
                  >
                    End interview
                  </button>
                </>
              ) : !account.user ? (
                <Link
                  to="/auth"
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
              )
            ) : (
              <>
                <span
                  role="img"
                  aria-label={
                    call.status === "connected" && !call.unstable ? "Live" : "Not live yet"
                  }
                  className={`h-3 w-3 rounded-full bg-accent ${call.status === "connected" && !call.unstable ? "live-pulse" : "opacity-50"}`}
                />
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {call.status === "connected"
                    ? call.unstable
                      ? "Connection interrupted · trying to recover…"
                      : `In the interview room · ${clock(Math.max(0, Math.min(elapsed, limitSeconds)))} of ${INTERVIEW_MINUTES}:00`
                    : call.status === "stopping"
                      ? "Wrapping up…"
                      : call.resumed
                        ? "Reconnecting…"
                        : "Connecting…"}
                </span>
                <button
                  disabled={call.status !== "connected"}
                  onClick={() => call.setMuted(!call.muted)}
                  className="ml-auto rounded-full border px-4 py-2 text-sm disabled:opacity-40"
                >
                  {call.muted ? "Unmute" : "Mute"}
                </button>
                <button
                  disabled={call.status === "stopping"}
                  onClick={call.stop}
                  className="rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-40"
                >
                  End interview
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Dr River speaks with a natural British voice.
          </p>
          {canReconnect && (
            <div role="status" className="mt-4 rounded-md border px-4 py-3 text-center text-sm">
              <p className="font-medium">The line dropped.</p>
              <p className="mt-1 text-muted-foreground">
                Reconnect to carry on where you left off. This won’t use another interview, and the
                time you have left stays the same.
              </p>
              {call.error && <p className="mt-1 text-xs text-muted-foreground">{call.error}</p>}
            </div>
          )}
          {call.playbackBlocked && (
            <button
              onClick={call.resumePlayback}
              className="mx-auto mt-3 block rounded-full border px-4 py-2 text-sm"
            >
              Play Dr River’s voice
            </button>
          )}
          {preview ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Preview mode · unlimited testing for tester accounts
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
                    {account.data.totalRemaining === 1 ? "interview" : "interviews"} remaining ·{" "}
                    {account.data.freeRemaining} free · {account.data.paidRemaining} purchased
                  </>
                )}
              </p>
            )
          )}
          {call.error && !canReconnect && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {call.error}
            </p>
          )}
        </section>

        {idle && call.ending === "time_up" && call.notice && (
          <p
            role="status"
            className="mt-10 rounded-md border border-accent/60 px-4 py-3 text-center text-sm"
          >
            {call.notice}
          </p>
        )}
        {lines.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-3xl font-semibold">
              {showReplay ? "Replay" : "Transcript"}
            </h2>
            {showReplay && (
              <p className="mt-1 text-sm text-muted-foreground">
                Read back how you argued. Where did Dr River push hardest?
              </p>
            )}
            <ol className="mt-6 space-y-5">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className={line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {line.role === "assistant" ? "Dr River" : "You"}
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

        {/* Feedback closes the interview for good, so wait until reconnecting is declined. */}
        {showReplay && !canReconnect && (
          <AssessPanel interviewId={call.interviewId} initialTranscript={formatTranscript(lines)} />
        )}
      </main>
      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Independent practice tool, not affiliated with the University of Cambridge or the University
        of Oxford. Dr River is an AI and can make mistakes.
      </footer>
    </div>
  );
}
