export type OrbState = "idle" | "connecting" | "listening" | "speaking";

// One colour per tutor so each voice has its own face.
const TONES = {
  river: {
    core: "radial-gradient(circle at 38% 32%, oklch(0.88 0.08 200), oklch(0.5 0.09 215) 58%, oklch(0.24 0.04 240))",
    glow: "oklch(0.72 0.1 210 / 0.45)",
    ring: "oklch(0.78 0.09 200 / 0.5)",
  },
  matt: {
    core: "radial-gradient(circle at 38% 32%, oklch(0.8 0.12 25), oklch(0.52 0.17 25) 58%, oklch(0.26 0.08 20))",
    glow: "oklch(0.6 0.18 25 / 0.42)",
    ring: "oklch(0.7 0.15 25 / 0.5)",
  },
} as const;

export function TutorOrb({
  tone,
  state,
  size = 220,
}: {
  tone: keyof typeof TONES;
  state: OrbState;
  size?: number;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`orb orb-${state} relative grid place-items-center`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="orb-ring absolute inset-[-14%] rounded-full border" style={{ borderColor: t.ring }} />
      <span className="orb-ring orb-ring-2 absolute inset-[-30%] rounded-full border" style={{ borderColor: t.ring }} />
      <span
        className="orb-core absolute inset-0 rounded-full"
        style={{ background: t.core, boxShadow: `0 0 90px ${t.glow}` }}
      />
    </div>
  );
}
