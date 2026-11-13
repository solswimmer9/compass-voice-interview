import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { readingById } from "@/lib/readings";
import {
  hasChosenSubject,
  parseInterviewChoice,
  type InterviewChoice,
} from "@/lib/interview-choice";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { LiveRoom } from "@/components/LiveRoom";
import { WaitingRoom } from "@/components/WaitingRoom";
import { tutorKey } from "@/lib/tutor-theme";
import { DotPattern } from "@/components/ui/dot-pattern";
import { INTERVIEW_MINUTES } from "@/lib/limits";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { isPreviewBrowser } from "@/lib/preview";
import { appendTranscriptFragment, type Line } from "@/lib/transcript";
import { saveFinishedInterview } from "@/lib/finished-interview";

/** The waiting room stays up at least this long, so it reads as a moment, not a flicker. */
const MIN_WAIT_MS = 2500;

export const Route = createFileRoute("/interview")({
  // tutor: "ppe" (Prof Matt) or "geography" (Dr River); a reading means geography. mode=object is
  // kept for old links (the chart opens the interview). start: set by "Start interview" so the
  // call connects straight away; removed once used, so a refresh never starts a second call.
  validateSearch: (search: Record<string, unknown>): InterviewChoice & { start?: true } => ({
    ...parseInterviewChoice(search),
    ...(search["start"] === true || search["start"] === "true" ? { start: true as const } : {}),
  }),
  beforeLoad: ({ search }) => {
    if (!hasChosenSubject(search)) throw redirect({ to: "/subjects" });
  },
  head: () => ({
    meta: [
      { title: "Interview room | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "A live, spoken Oxbridge-style interview that challenges your reasoning.",
      },
    ],
  }),
  component: InterviewRoom,
});

/** What the browser is shown of the tutor's chart. The tutor's notes never reach it. */
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
    <figure className="rounded-md border bg-card p-4 sm:p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4">
      <figcaption className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        {object.caption}
      </figcaption>
      <img src={src} alt={object.alt} className="mt-4 block h-auto w-full" />
    </figure>
  );
}

function InterviewRoom() {
  const [lines, setLines] = useState<Line[]>([]);
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

  const search = Route.useSearch();
  const { reading: readingParam, tutor: tutorParam, mode } = search;
  const ppe = tutorParam === "ppe";
  const objectMode = mode === "object";
  // Practice readings are geography articles, so PPE and object interviews ignore them.
  const reading = ppe || objectMode ? undefined : readingById(readingParam);
  const tutorName = ppe ? "Prof Matt" : "Dr River";
  const subjectLabel = ppe ? "PPE · Prof Matt" : "Geography · Dr River";
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
  const navigate = useNavigate();

  // Waiting room: up while connecting, and for at least MIN_WAIT_MS after Start.
  const [waitedEnough, setWaitedEnough] = useState(true);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
    },
    [],
  );

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

  const startedRef = useRef(false);
  const start = () => {
    setLines([]);
    setCardIds([]);
    setTableObject(null);
    fragmentSequence.current = 0;
    startedRef.current = true;
    setWaitedEnough(false);
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = setTimeout(() => setWaitedEnough(true), MIN_WAIT_MS);
    call.start();
  };

  const interviewId = call.interviewId;
  const refetchAccount = account.refetch;
  useEffect(() => {
    if (interviewId && interviewId !== "preview") void refetchAccount();
  }, [interviewId, refetchAccount]);

  // "Start interview" on the subject page lands here with start=true: sign in first if needed,
  // stay on this page (showing "Get more interviews") when there are none left, else connect.
  const autoStart = search.start === true;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || account.loading) return;
    autoStarted.current = true;
    const { start: _start, ...choice } = search;
    if (!account.user) {
      void navigate({
        to: "/auth",
        search: {
          ...(choice.tutor ? { tutor: choice.tutor } : {}),
          ...(choice.mode ? { mode: choice.mode } : {}),
        },
        replace: true,
      });
      return;
    }
    void navigate({ to: "/interview", search: choice, replace: true });
    if (!isPreviewBrowser() && account.data?.totalRemaining === 0) return;
    start();
    // start() is recreated every render; this should only fire when a pick arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, account.loading, account.user, account.data, search, navigate]);

  // When the call ends with something said, go straight to the feedback letter.
  const idle = call.status === "idle" || call.status === "closed";
  const handedOff = useRef(false);
  useEffect(() => {
    if (call.status !== "closed" || handedOff.current || !startedRef.current) return;
    if (!lines.length || !call.interviewId) return;
    handedOff.current = true;
    saveFinishedInterview({
      interviewId: call.interviewId,
      tutor: ppe ? "ppe" : "geography",
      lines: lines.map(({ role, text }) => ({ role, text })),
      ...(ppe && cardIds.length ? { cardIds } : {}),
      ...(tableObject ? { objectId: tableObject.objectId } : {}),
    });
    void navigate({ to: "/feedback" });
  }, [call.status, call.interviewId, lines, ppe, cardIds, tableObject, navigate]);

  const cancel = () => {
    call.stop();
    void navigate({ to: "/subjects" });
  };

  const waiting = call.status === "connecting" || (call.status === "connected" && !waitedEnough);
  const tutorTheme = tutorKey(ppe ? "ppe" : undefined);

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      {/* Always mounted, so the tutor's voice keeps playing as the room changes views. */}
      <audio ref={call.audioRef} controls className="hidden" playsInline />
      {waiting ? (
        <WaitingRoom
          tutor={tutorTheme}
          tutorName={tutorName}
          subjectLabel={subjectLabel}
          audioRef={call.audioRef}
          error={call.error}
          onCancel={cancel}
        />
      ) : !idle ? (
        <LiveRoom
          tutor={tutorTheme}
          tutorName={tutorName}
          subjectLabel={subjectLabel}
          objectMode={objectMode}
          object={tableObject ? <ObjectCard object={tableObject} /> : undefined}
          status={call.status === "connected" ? "connected" : "stopping"}
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
      ) : (
        <main className="relative z-10 mx-auto flex min-h-[100svh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            {subjectLabel}
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {lines.length ? "Getting your letter ready…" : `Interview with ${tutorName}`}
          </h1>
          {reading && (
            <p className="mt-3 text-muted-foreground">
              Reading interview: <span className="text-foreground">{reading.title}</span>
            </p>
          )}
          {call.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {call.error}
            </p>
          )}
          {!lines.length && (
            <div className="mt-8 flex flex-col items-center gap-4">
              {!account.user && !account.loading ? (
                <Link
                  to="/auth"
                  search={{
                    tutor: ppe ? ("ppe" as const) : ("geography" as const),
                    ...(objectMode ? { mode: "object" as const } : {}),
                  }}
                  className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
                >
                  Sign in to start
                </Link>
              ) : !preview && account.data?.totalRemaining === 0 ? (
                <>
                  <p className="text-muted-foreground">You have used all your interviews.</p>
                  <Link
                    to="/pricing"
                    className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
                  >
                    Get more interviews
                  </Link>
                </>
              ) : (
                <button
                  onClick={start}
                  disabled={!preview && account.loading}
                  className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                >
                  {call.error ? "Try again" : "Start interview"}
                </button>
              )}
              <Link to="/subjects" className="text-sm text-muted-foreground underline">
                Change subject
              </Link>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
