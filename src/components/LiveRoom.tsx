import { useEffect, type ReactNode, type RefObject } from "react";
import { LiveCaption } from "@/components/LiveCaption";
import { TutorOrb } from "@/components/TutorOrb";
import type { TutorKey } from "@/lib/tutor-theme";

type LiveStatus = "connecting" | "connected" | "stopping";

/**
 * The interview room during a call: the tutor's orb in the centre, live captions under it,
 * and the clock, Mute and End along the bottom. An object interview's chart sits beside the orb.
 */
export function LiveRoom({
  tutor,
  tutorName,
  subjectLabel,
  objectMode,
  object,
  status,
  audioRef,
  line,
  clock,
  muted,
  onToggleMute,
  onEnd,
  playbackBlocked,
  onResumePlayback,
  error,
}: {
  tutor: TutorKey;
  tutorName: string;
  /** e.g. "PPE · Prof Matt" */
  subjectLabel: string;
  objectMode: boolean;
  /** The chart on the table, if any. */
  object?: ReactNode;
  status: LiveStatus;
  audioRef: RefObject<HTMLAudioElement | null>;
  /** The latest line of the conversation. */
  line: { role: "user" | "assistant"; text: string; key?: number } | undefined;
  /** e.g. "11:24 / 20:00" */
  clock: string;
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  playbackBlocked: boolean;
  onResumePlayback: () => void;
  error: string | null;
}) {
  // The room replaces a page the student may have scrolled down to reach Start.
  useEffect(() => window.scrollTo({ top: 0 }), []);
  return (
    <main
      className={`relative z-10 mx-auto flex min-h-[100svh] flex-col px-6 py-6 ${object ? "max-w-5xl" : "max-w-4xl"}`}
    >
      <header className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>{subjectLabel}</span>
        {objectMode && <span>Object interview</span>}
      </header>
      <div
        className={
          object
            ? "grid flex-1 content-center items-center gap-4 py-4 sm:gap-8 sm:py-8 lg:grid-cols-[3fr_2fr]"
            : "flex flex-1 flex-col justify-center py-8"
        }
      >
        {object}
        <div>
          <TutorOrb tutor={tutor} status={status} audioRef={audioRef} size={object ? "sm" : "lg"} />
          <LiveCaption
            role={line?.role ?? null}
            key={line?.key}
            text={line?.text ?? ""}
            tutorName={tutorName}
            compact={Boolean(object)}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 pb-4 sm:pb-8">
        {playbackBlocked && (
          <button onClick={onResumePlayback} className="rounded-full border px-4 py-2 text-sm">
            Play {tutorName}’s voice
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">
            {status === "connected"
              ? clock
              : status === "stopping"
                ? "Wrapping up…"
                : "Connecting…"}
          </span>
          <button
            disabled={status !== "connected"}
            onClick={onToggleMute}
            className="rounded-full border px-5 py-2 text-sm disabled:opacity-40"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            disabled={status === "stopping"}
            onClick={onEnd}
            className="rounded-full border border-destructive px-5 py-2 text-sm text-destructive disabled:opacity-40"
          >
            End
          </button>
        </div>
      </div>
    </main>
  );
}
