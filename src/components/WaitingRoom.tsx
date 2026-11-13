import { useEffect, useState, type RefObject } from "react";
import { TutorOrb } from "@/components/TutorOrb";
import type { TutorKey } from "@/lib/tutor-theme";

const TIPS = [
  "Think out loud. Interviewers want to hear how you get there, not just where you end up.",
  "It is fine to pause, or to say you are not sure and reason it through.",
  "If you change your mind, say so and say why. That is a strength.",
  "Partway through, your tutor will put a chart on the table for you to make sense of.",
];

/**
 * Shown while the call connects, so the student is not left watching a frozen screen.
 * The connection runs in the background; this only explains the wait.
 */
export function WaitingRoom({
  tutor,
  tutorName,
  subjectLabel,
  audioRef,
  error,
  chartLater,
  onCancel,
}: {
  tutor: TutorKey;
  tutorName: string;
  subjectLabel: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  error: string | null;
  /** True when the tutor will bring a chart out partway through (not in reading interviews). */
  chartLater: boolean;
  onCancel: () => void;
}) {
  const tips = chartLater ? TIPS : TIPS.filter((text) => !text.includes("chart"));
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTip((n) => n + 1), 4000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main className="relative z-10 mx-auto flex min-h-[100svh] max-w-2xl flex-col px-6 py-6">
      <header className="text-sm text-muted-foreground">{subjectLabel}</header>
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <TutorOrb tutor={tutor} status="connecting" audioRef={audioRef} size="md" />
        <h1 className="mt-10 text-2xl font-medium tracking-tight sm:text-3xl" aria-live="polite">
          {tutorName} is getting ready…
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Allow the microphone if your browser asks. This takes a few seconds.
        </p>
        <p
          key={tip}
          className="mt-10 max-w-md text-foreground/90 motion-safe:animate-in motion-safe:fade-in"
        >
          {tips[tip % tips.length]}
        </p>
        {error && (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-center pb-4">
        <button onClick={onCancel} className="rounded-full border px-5 py-2 text-sm">
          Cancel
        </button>
      </div>
    </main>
  );
}
