import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { readingById } from "@/lib/readings";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { AssessPanel } from "@/components/AssessPanel";
import { TutorOrb, type OrbState } from "@/components/TutorOrb";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { isPreviewBrowser } from "@/lib/preview";
import { appendTranscriptFragment, type Line } from "@/lib/transcript";
import { parseInterviewSearch } from "@/lib/interview-search";

export const Route = createFileRoute("/interview")({
  validateSearch: parseInterviewSearch,
  head: () => ({
    meta: [
      { title: "Interview room | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "A live, spoken Oxbridge-style interview that challenges your reasoning.",
      },
      { property: "og:title", content: "Interview room" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: InterviewRoom,
});

const TUTORS = {
  geography: {
    name: "Dr River",
    subject: "Geography",
    tone: "river" as const,
    blurb: "Informed by real Cambridge geography notes. He will ask why, then ask again.",
  },
  ppe: {
    name: "Prof Matt",
    subject: "PPE",
    tone: "matt" as const,
    blurb: "Oxford-style Philosophy, Politics and Economics. He will test your premises.",
  },
};

function InterviewRoom() {
  const [lines, setLines] = useState<Line[]>([]);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const fragmentSequence = useRef(0);
  const speakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const onEvent = useCallback((event: LiveEvent) => {
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
    if (role === "assistant") {
      // The tutor's words arrive as they are spoken, so recent text means he is talking.
      setSpeaking(true);
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
      speakingTimer.current = setTimeout(() => setSpeaking(false), 1200);
    }
    const fragment = {
      text: event.delta,
      start: typeof event.start_ms === "number" ? event.start_ms : 0,
      end: typeof event.end_ms === "number" ? event.end_ms : 0,
      sequence: ++fragmentSequence.current,
    };
    setLines((previous) => appendTranscriptFragment(previous, role, fragment));
  }, []);
  useEffect(
    () => () => {
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    },
    [],
  );

  const { reading: readingParam, tutor: tutorParam } = Route.useSearch();
  const ppe = tutorParam === "ppe";
  const tutor = ppe ? TUTORS.ppe : TUTORS.geography;
  // Practice readings are geography articles, so PPE interviews ignore them.
  const reading = ppe ? undefined : readingById(readingParam);
  const getStartContext = useCallback(async () => {
    const environment = getPaymentsEnvironment();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Please sign in again before starting your interview.");
    if (ppe) return { accessToken, environment, tutorId: "ppe" as const };
    return { accessToken, environment, ...(reading ? { readingId: reading.id } : {}) };
  }, [reading, ppe]);
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
    if (showTranscript) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines, showTranscript]);

  const start = () => {
    setLines([]);
    setCardIds([]);
    setShowTranscript(false);
    fragmentSequence.current = 0;
    call.start();
  };

  const interviewId = call.interviewId;
  const refetchAccount = account.refetch;
  useEffect(() => {
    if (interviewId && interviewId !== "preview") void refetchAccount();
  }, [interviewId, refetchAccount]);

  // Also true after a dropped call, so an interview that ended early can still be assessed.
  const finished = idle && lines.length > 0;
  const orbState: OrbState =
    call.status === "connecting"
      ? "connecting"
      : call.status === "connected"
        ? speaking
          ? "speaking"
          : "listening"
        : "idle";

  const allowance = !account.user
    ? null
    : preview
      ? "Tester mode · unlimited"
      : account.data
        ? account.data.lifetime
          ? "Lifetime access"
          : `${account.data.totalRemaining} ${account.data.totalRemaining === 1 ? "interview" : "interviews"} left`
        : null;

  const transcriptList = (
    <ol className="space-y-5">
      {lines.map((line, i) => (
        <li
          key={i}
          className={line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {line.role === "assistant" ? tutor.name : "You"}
          </p>
          <p className={line.role === "assistant" ? "mt-1 font-serif text-lg italic" : "mt-1"}>
            {line.text}
          </p>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="relative min-h-[100svh]">
      <nav className="relative z-20 mx-auto flex max-w-3xl items-center justify-between px-6 pt-6 text-sm">
        <Link to="/" className="text-muted-foreground transition hover:text-foreground">
          ← Home
        </Link>
        {allowance && <span className="text-muted-foreground">{allowance}</span>}
      </nav>

      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-16">
        <audio ref={call.audioRef} controls className="hidden" playsInline />

        {!finished && (
          <section className="flex min-h-[70svh] flex-col items-center justify-center pt-24 pb-8 text-center">
            <div className="scale-[0.8] sm:scale-100">
              <TutorOrb tone={tutor.tone} state={orbState} size={200} />
            </div>
            <p className="mt-16 text-xs font-medium uppercase sm:mt-24 tracking-[0.25em] text-muted-foreground">
              {tutor.subject}
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">{tutor.name}</h1>

            {idle ? (
              <>
                <p className="mt-3 max-w-md text-muted-foreground">
                  {reading ? (
                    <>
                      Reading interview: <span className="text-foreground">{reading.title}</span>
                    </>
                  ) : (
                    tutor.blurb
                  )}
                </p>
                <div className="mt-8">
                  {!account.user ? (
                    <Link
                      to="/auth"
                      search={ppe ? { tutor: "ppe" } : {}}
                      className="inline-flex rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
                    >
                      Sign in to start
                    </Link>
                  ) : !preview && account.data?.totalRemaining === 0 ? (
                    <Link
                      to="/pricing"
                      className="inline-flex rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
                    >
                      Get more interviews
                    </Link>
                  ) : (
                    <button
                      onClick={start}
                      disabled={!preview && account.loading}
                      className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                    >
                      Start interview
                    </button>
                  )}
                </div>
                <p className="mt-6 text-sm text-muted-foreground">
                  Up to {INTERVIEW_MINUTES} minutes, out loud. Thinking aloud is the point.
                </p>
                <p className="mt-2 text-sm">
                  {reading ? (
                    <Link to="/interview" search={{}} className="text-muted-foreground underline">
                      Switch to a normal interview
                    </Link>
                  ) : (
                    <Link to="/" hash="subjects" className="text-muted-foreground underline">
                      Change subject
                    </Link>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-muted-foreground" aria-live="polite">
                  {call.status === "connected"
                    ? `${speaking ? `${tutor.name} is speaking` : "Listening"} · ${clock(Math.min(elapsed, INTERVIEW_MINUTES * 60))} / ${INTERVIEW_MINUTES}:00`
                    : call.status === "stopping"
                      ? "Wrapping up…"
                      : "Connecting…"}
                </p>
                <div className="mt-8 flex items-center gap-3">
                  <button
                    disabled={call.status !== "connected"}
                    onClick={() => call.setMuted(!call.muted)}
                    className="rounded-full border px-5 py-2.5 text-sm disabled:opacity-40"
                  >
                    {call.muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    disabled={call.status === "stopping"}
                    onClick={call.stop}
                    className="rounded-full bg-destructive px-5 py-2.5 text-sm text-destructive-foreground disabled:opacity-40"
                  >
                    End interview
                  </button>
                </div>
                {lines.length > 0 && (
                  <button
                    onClick={() => setShowTranscript((v) => !v)}
                    className="mt-6 text-sm text-muted-foreground underline"
                  >
                    {showTranscript ? "Hide transcript" : "Show live transcript"}
                  </button>
                )}
              </>
            )}

            {call.playbackBlocked && (
              <button
                onClick={call.resumePlayback}
                className="mt-4 rounded-full border px-4 py-2 text-sm"
              >
                Play {tutor.name}’s voice
              </button>
            )}
            {call.error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {call.error}
              </p>
            )}
          </section>
        )}

        {!finished && showTranscript && (
          <section className="rounded-md border bg-card p-6 text-left">
            {transcriptList}
            <div ref={endRef} />
          </section>
        )}

        {finished && (
          <div className="pt-12">
            <div className="flex items-center gap-5">
              <TutorOrb tone={tutor.tone} state="idle" size={44} />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                  {tutor.subject} · {tutor.name}
                </p>
                <h1 className="mt-1 text-2xl font-medium tracking-tight">Interview finished</h1>
              </div>
            </div>
            {call.error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {call.error}
              </p>
            )}

            <div className="mt-8">
              <AssessPanel
                interviewId={call.interviewId}
                {...(ppe ? { tutorId: "ppe" as const, cardIds } : {})}
                transcript={lines
                  .map((l) => `${l.role === "assistant" ? tutor.name : "You"}: ${l.text.trim()}`)
                  .join("\n\n")}
              />
            </div>

            <details className="mt-6 rounded-md border border-dashed p-6">
              <summary className="cursor-pointer font-medium">Read back the transcript</summary>
              <p className="mt-2 text-sm text-muted-foreground">
                Where did {tutor.name} push hardest?
              </p>
              <div className="mt-6">{transcriptList}</div>
            </details>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {!preview &&
              account.data &&
              !account.data.lifetime &&
              account.data.totalRemaining === 0 ? (
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
                  className="rounded-full border px-6 py-3 font-medium transition hover:bg-secondary disabled:opacity-40"
                >
                  Start a new interview
                </button>
              )}
              <Link to="/" hash="subjects" className="text-sm text-muted-foreground underline">
                Try another subject
              </Link>
            </div>
          </div>
        )}
      </main>
      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Not affiliated with Oxford or Cambridge. AI can make mistakes.
      </footer>
    </div>
  );
}
