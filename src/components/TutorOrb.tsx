import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { rmsLevel } from "@/lib/audio-level";
import { TUTOR_THEME, type TutorKey } from "@/lib/tutor-theme";
import graduate from "@/assets/home/graduate.webp";
import reader from "@/assets/home/reader.webp";

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
  /** "lg" is the live room's centrepiece; "sm" shares the room with a chart. */
  size?: "sm" | "md" | "lg";
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
      className={`tutor-orb mx-auto flex flex-col items-center ${size === "md" ? "mb-6" : ""}`}
      style={
        {
          "--orb-level": "0",
          opacity: live ? 1 : 0.65,
          transition: "opacity 600ms ease",
        } as CSSProperties
      }
    >
      <div
        className={`relative ${size === "lg" ? "size-44 sm:size-[280px]" : size === "sm" ? "size-24 sm:size-[200px]" : "size-40 sm:size-[200px]"}`}
      >
        <Halo tutor={tutor} />
      </div>
      <span
        className="mt-5 text-[10px] font-medium uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.2em]"
        style={{ color: theme.colour }}
      >
        {label}
      </span>
    </div>
  );
}

/** Each tutor's sketch portrait: Prof Matt the graduate, Dr River the reader. */
const PORTRAITS: Record<TutorKey, string> = { matt: graduate, river: reader };

/** Eight nested squares, each a little smaller and more turned: the homepage rose, slimmed. */
const SQUARES = Array.from({ length: 8 }, (_, i) => ({
  inset: `${(i * 4.5 + 16) / 2}%`,
  turn: `${i * 8}deg`,
  delay: `${(-i * 0.22).toFixed(2)}s`,
  alpha: Math.max(0.08, 0.55 - i * 0.05),
}));

/**
 * The Meridian Halo: the tutor's portrait in a ring of their colour, inside a slowly turning
 * rose. The rose swells a little and the portrait glows as the tutor speaks (--orb-level).
 */
function Halo({ tutor }: { tutor: TutorKey }) {
  const { colour, rgb } = TUTOR_THEME[tutor];
  return (
    <>
      <div className="halo-turn absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ transform: "scale(calc(1 + var(--orb-level) * 0.25))" }}
        >
          {SQUARES.map((square) => (
            <div
              key={square.turn}
              className="halo-sq"
              style={
                {
                  inset: square.inset,
                  "--r": square.turn,
                  animationDelay: square.delay,
                  borderColor: `rgb(${rgb} / ${square.alpha})`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div
        className="absolute inset-[28%] overflow-hidden rounded-full bg-[#f2f2f0]"
        style={{
          border: `2px solid ${colour}`,
          transform: "scale(calc(1 + var(--orb-level) * 0.08))",
          boxShadow: `0 0 calc(10px + var(--orb-level) * 140px) rgb(${rgb} / 0.35)`,
        }}
      >
        <img src={PORTRAITS[tutor]} alt="" className="size-full object-cover grayscale" />
      </div>
    </>
  );
}
