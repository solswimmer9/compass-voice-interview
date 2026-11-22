import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { readingById } from "@/lib/readings";
import { subjectOrGeography } from "@/lib/subjects";
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
import { GUEST_INTERVIEWS } from "@/lib/offer";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { isPreviewBrowser } from "@/lib/preview";
import { appendTranscriptFragment, buildResumeRecap, type Line } from "@/lib/transcript";
import { saveFinishedInterview } from "@/lib/finished-interview";
import { autoStartAction, shouldHandOffToFeedback } from "@/lib/interview-handoff";

/** The waiting room stays up at least this long, so it reads as a moment, not a flicker. */
const MIN_WAIT_MS = 2500;

export const Route = createFileRoute("/interview")({
  // tutor: "ppe" (Prof Matt), "biology" (Dr Toby) or "geography" (Dr River); a reading means geography. mode=object is
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
  const transcriptSegment = useRef(0);
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
      // Each reconnect starts a new voice session whose timings restart from zero.
      segment: transcriptSegment.current,
    };
    setLines((previous) => appendTranscriptFragment(previous, role, fragment));
  }, []);

  const search = Route.useSearch();
  const { reading: readingParam, tutor: tutorParam, mode } = search;
  const subject = subjectOrGeography(tutorParam);
  const tutorId = subject.id;
  const objectMode = mode === "object";
  // A reading counts only for its own subject's tutor; object interviews ignore readings.
  // (Only Dr River's server path runs reading interviews so far.)
  const reading = objectMode ? undefined : readingById(readingParam, tutorId);
  const tutorName = subject.tutor;
  const subjectLabel = `${subject.name} · ${subject.tutor}`;
  const getStartContext = useCallback(async () => {
    const environment = getPaymentsEnvironment();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Please sign in again before starting your interview.");
    const objectRequest = objectMode ? { mode: "object" as const } : {};
    if (tutorId !== "geography") return { accessToken, environment, tutorId, ...objectRequest };
    return {
      accessToken,
      environment,
      ...objectRequest,
      ...(reading ? { readingId: reading.id } : {}),
    };
  }, [reading, tutorId, objectMode]);
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
  const endsAt = call.endsAt;
  useEffect(() => {
    if (call.status !== "connected") return;
    const startedAt = Date.now();
    const limitSeconds = INTERVIEW_MINUTES * 60;
    // Prefer the server's deadline, which also covers a resumed interview's time left.
    const tick = () =>
      setElapsed(
        endsAt === null
          ? Math.floor((Date.now() - startedAt) / 1000)
          : limitSeconds - Math.ceil(Math.max(0, endsAt - Date.now()) / 1000),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.status, endsAt]);
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const startedRef = useRef(false);
  const start = () => {
    setLines([]);
    setCardIds([]);
    setTableObject(null);
    fragmentSequence.current = 0;
    transcriptSegment.current = 0;
    startedRef.current = true;
    setWaitedEnough(false);
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = setTimeout(() => setWaitedEnough(true), MIN_WAIT_MS);
    call.start();
  };

  // Tester accounts (PREVIEW_TESTER_EMAILS, checked on the server) are never out of interviews.
  const unlimited = preview || Boolean(account.data?.tester);
  const outOfInterviews = !unlimited && account.data?.totalRemaining === 0;
  // A guest who has used their free tries must sign in; anyone else with none left must buy more.
  const guestUsedUp = !account.user && Boolean(account.guest) && outOfInterviews;
  const authSearch = {
    tutor: tutorId,
    ...(objectMode ? { mode: "object" as const } : {}),
  };

  // Not signed in: start as a guest (an anonymous account), so the free tries need no sign-in.
  // The database still enforces how many tries a guest gets. If guest sessions are unavailable,
  // fall back to the sign-in page as before.
  const [startingGuest, setStartingGuest] = useState(false);
  const startInterview = async () => {
    if (!account.user && !account.guest) {
      setStartingGuest(true);
      const { error } = await supabase.auth.signInAnonymously();
      setStartingGuest(false);
      if (error) {
        void navigate({ to: "/auth", search: authSearch });
        return;
      }
    }
    start();
  };

  const interviewId = call.interviewId;
  const refetchAccount = account.refetch;
  useEffect(() => {
    if (interviewId && interviewId !== "preview") void refetchAccount();
  }, [interviewId, refetchAccount]);

  // "Start interview" on the subject page lands here with start=true: a guest who has used their
  // free tries signs in first, anyone with none left stays here (showing "Get more interviews"),
  // everyone else connects (starting a guest session if they are not signed in).
  const autoStart = search.start === true;
  const autoStarted = useRef(false);
  useEffect(() => {
    const action = autoStartAction({
      accountLoading: account.loading,
      guestUsedUp,
      outOfInterviews,
      previewBrowser: isPreviewBrowser(),
    });
    if (!autoStart || autoStarted.current || action === "wait") return;
    autoStarted.current = true;
    const { start: _start, ...choice } = search;
    if (action === "sign-in") {
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
    if (action === "out-of-interviews") return;
    void startInterview();
    // startInterview() is recreated every render; this should only fire when a pick arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, account.loading, guestUsedUp, outOfInterviews, search, navigate]);

  // A call that connected and then dropped can be resumed without using another interview.
  const canReconnect =
    call.status === "closed" && call.ending === "dropped" && Boolean(call.interviewId);
  const reconnect = () => {
    // Earlier lines stay; new ones are kept as a separate segment.
    transcriptSegment.current += 1;
    call.reconnect(buildResumeRecap(lines, undefined, tutorName));
  };

  // When the call ends with something said, go straight to the feedback letter. Feedback closes
  // the interview for good, so a dropped call waits until reconnecting is declined.
  const idle = call.status === "idle" || call.status === "closed";
  const handedOff = useRef(false);
  useEffect(() => {
    if (
      !call.interviewId ||
      !shouldHandOffToFeedback({
        callStatus: call.status,
        alreadyHandedOff: handedOff.current,
        startedHere: startedRef.current,
        canReconnect,
        lineCount: lines.length,
        interviewId: call.interviewId,
      })
    )
      return;
    handedOff.current = true;
    saveFinishedInterview({
      interviewId: call.interviewId,
      tutor: tutorId,
      lines: lines.map(({ role, text }) => ({ role, text })),
      ...(tutorId !== "geography" && cardIds.length ? { cardIds } : {}),
      ...(tableObject ? { objectId: tableObject.objectId } : {}),
    });
    void navigate({ to: "/feedback" });
  }, [call.status, call.interviewId, canReconnect, lines, tutorId, cardIds, tableObject, navigate]);

  const cancel = () => {
    call.stop();
    void navigate({ to: "/subjects" });
  };

  const waiting = call.status === "connecting" || (call.status === "connected" && !waitedEnough);
  const tutorTheme = tutorKey(tutorId);

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
          // Biology's diagrams arrive with its questions, not at a set minute.
          chartLater={!reading && !objectMode && tutorId !== "biology"}
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
          error={
            call.error ?? (call.unstable ? "Connection is unstable. Trying to recover…" : null)
          }
        />
      ) : (
        <main className="relative z-10 mx-auto flex min-h-[100svh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            {subjectLabel}
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {canReconnect
              ? "The call dropped"
              : lines.length
                ? "Getting your letter ready…"
                : `Interview with ${tutorName}`}
          </h1>
          {canReconnect && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <p className="text-muted-foreground">
                Reconnect to carry on where you left off. This won’t use another interview, and the
                time you have left still counts down.
              </p>
              <button
                onClick={reconnect}
                className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90"
              >
                Reconnect
              </button>
              <button
                onClick={call.dismissReconnect}
                className="text-sm text-muted-foreground underline"
              >
                End interview and get feedback
              </button>
            </div>
          )}
          {reading && (
            <p className="mt-3 text-muted-foreground">
              Reading interview: <span className="text-foreground">{reading.title}</span>
            </p>
          )}
          {call.error && !canReconnect && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {call.error}
            </p>
          )}
          {!lines.length && !canReconnect && (
            <div className="mt-8 flex flex-col items-center gap-4">
              {guestUsedUp ? (
                <>
                  <p className="text-muted-foreground">
                    You have used your free tries. Sign in to keep practising.
                  </p>
                  <Link
                    to="/auth"
                    search={authSearch}
                    className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
                  >
                    Sign in to continue
                  </Link>
                </>
              ) : outOfInterviews ? (
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
                  onClick={() => void startInterview()}
                  disabled={startingGuest || (!preview && account.loading)}
                  className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                >
                  {call.error ? "Try again" : "Start interview"}
                </button>
              )}
              {!account.user && !account.loading && !guestUsedUp && (
                <p className="text-sm text-muted-foreground">
                  {GUEST_INTERVIEWS} free tries, no sign-in needed.{" "}
                  <Link to="/auth" search={authSearch} className="underline">
                    Sign in
                  </Link>
                </p>
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
