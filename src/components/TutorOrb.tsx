import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { rmsLevel } from "@/lib/audio-level";
import { TUTOR_THEME, type TutorKey } from "@/lib/tutor-theme";

type OrbStatus = "connecting" | "connected" | "stopping";

const SPEAKING_THRESHOLD = 0.06;
const SPEAKING_HOLD_MS = 450;

/**
 * An animated orb for the tutor that reacts to the tutor's voice. It reads the remote
 * MediaStream already attached to the call's <audio> element and analyses it with an
 * AnalyserNode that is never connected to the speakers, so playback is unaffected.
 */
export function TutorOrb({
  tutor,
  status,
  audioRef,
  size = "md",
}: {
  tutor: TutorKey;
  status: OrbStatus;
  audioRef: RefObject<HTMLAudioElement | null>;
  /** "lg" is the live room's centrepiece. */
  size?: "md" | "lg";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [analysing, setAnalysing] = useState(true);
  const live = status === "connected";
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let samples: Float32Array<ArrayBuffer> | null = null;
    let attachedStream: MediaStream | null = null;
    let failed = !AudioContextClass;
    let smoothed = 0;
    let lastLoudAt = 0;
    let speakingNow = false;
    let frame = 0;
    let resuming = false;

    if (failed) setAnalysing(false);

    function attach(stream: MediaStream) {
      if (failed || !AudioContextClass) return;
      try {
        context ??= new AudioContextClass();
        if (!analyser) {
          analyser = context.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.6;
          samples = new Float32Array(analyser.fftSize);
        }
        source?.disconnect();
        source = context.createMediaStreamSource(stream);
        // Deliberately not connected to context.destination: the <audio> element plays it.
        source.connect(analyser);
        attachedStream = stream;
      } catch {
        failed = true;
        setAnalysing(false);
      }
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      const stream = audioRef.current?.srcObject;
      if (stream instanceof MediaStream && stream !== attachedStream) {
        if (stream.getAudioTracks().length > 0) attach(stream);
      }

      let level = 0;
      if (context?.state === "suspended" && !resuming) {
        // Retried until the browser allows audio (e.g. after the next user gesture).
        resuming = true;
        void context.resume().then(
          () => (resuming = false),
          () => (resuming = false),
        );
      }
      if (liveRef.current && analyser && samples && context?.state === "running") {
        analyser.getFloatTimeDomainData(samples);
        const raw = rmsLevel(samples);
        // Quick attack, slow release, so the orb swells with speech and settles calmly.
        smoothed += (raw - smoothed) * (raw > smoothed ? 0.45 : 0.08);
        level = smoothed;
        if (smoothed > SPEAKING_THRESHOLD) lastLoudAt = now;
        const nextSpeaking = now - lastLoudAt < SPEAKING_HOLD_MS && lastLoudAt > 0;
        if (nextSpeaking !== speakingNow) {
          speakingNow = nextSpeaking;
          setSpeaking(nextSpeaking);
        }
      } else {
        // No analysis (yet, or unavailable): a gentle idle breath.
        level = 0.06 + Math.sin(now / 1400) * 0.05;
        if (speakingNow) {
          speakingNow = false;
          setSpeaking(false);
        }
      }
      if (!reducedMotion) root!.style.setProperty("--orb-level", level.toFixed(3));
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      void context?.close().catch(() => {});
    };
  }, [audioRef]);

  const theme = TUTOR_THEME[tutor];
  const label =
    status === "connecting"
      ? "Connecting…"
      : status === "stopping"
        ? "Wrapping up…"
        : speaking
          ? "Speaking"
          : analysing
            ? "Listening"
            : "Live";

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-testid="tutor-orb"
      data-tutor={tutor}
      data-speaking={speaking}
      className={`tutor-orb relative mx-auto grid place-items-center ${size === "lg" ? "size-44 sm:size-[280px]" : "mb-6 size-40 sm:size-[200px]"}`}
      style={
        {
          "--orb-level": "0",
          opacity: live ? 1 : 0.65,
          transition: "opacity 600ms ease",
        } as CSSProperties
      }
    >
      {tutor === "river" ? <RiverOrb theme={theme} /> : <MattOrb theme={theme} />}
      <span
        className="relative text-[10px] font-medium uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.2em]"
        style={{ color: tutor === "river" ? "oklch(0.97 0.02 200)" : theme.accentSoft }}
      >
        {label}
      </span>
    </div>
  );
}

const scaled = (amount: number): CSSProperties => ({
  transform: `scale(calc(1 + var(--orb-level) * ${amount}))`,
});

function RiverOrb({ theme }: { theme: (typeof TUTOR_THEME)["river"] }) {
  return (
    <>
      <div className="orb-ripples absolute inset-0">
        {[0, 1].map((ring) => (
          <span
            key={ring}
            className="orb-ripple absolute inset-[12%] rounded-full border"
            style={{ borderColor: theme.accentSoft, animationDelay: `${ring * 1.6}s` }}
          />
        ))}
      </div>
      <div
        className="absolute inset-[12%] rounded-full"
        style={{
          ...scaled(0.12),
          background: `radial-gradient(circle at 35% 30%, ${theme.accentSoft} 0%, ${theme.accent} 55%, ${theme.deep} 100%)`,
          boxShadow: `0 0 calc(16px + var(--orb-level) * 40px) color-mix(in oklab, ${theme.accentSoft} 55%, transparent)`,
        }}
      />
    </>
  );
}

function MattOrb({ theme }: { theme: (typeof TUTOR_THEME)["matt"] }) {
  return (
    <>
      <div
        className="orb-tick absolute inset-[3%] rounded-full border-2 border-dashed"
        style={{ borderColor: theme.accentSoft, opacity: 0.7 }}
      />
      <div
        className="absolute inset-[13%] rounded-full"
        style={{
          ...scaled(0.08),
          background: `conic-gradient(from 0deg, ${theme.accentSoft}, ${theme.accent}, ${theme.accentSoft}, ${theme.accent}, ${theme.accentSoft})`,
          boxShadow: `0 0 calc(10px + var(--orb-level) * 32px) color-mix(in oklab, ${theme.accentSoft} 50%, transparent)`,
        }}
      >
        <div className="absolute inset-[9%] rounded-full" style={{ background: theme.deep }} />
      </div>
    </>
  );
}
