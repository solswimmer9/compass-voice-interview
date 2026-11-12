import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { TutorOrb } from "@/components/TutorOrb";
import { rmsLevel } from "@/lib/audio-level";
import { TUTOR_THEME, tutorKey } from "@/lib/tutor-theme";

describe("tutor theme", () => {
  it("maps geography to Dr River and PPE to Prof Matt", () => {
    expect(tutorKey()).toBe("river");
    expect(tutorKey("ppe")).toBe("matt");
    expect(TUTOR_THEME.river.name).toBe("Dr River");
    expect(TUTOR_THEME.matt.name).toBe("Prof Matt");
  });
});

describe("rmsLevel", () => {
  it("is zero for silence and rises with loudness, capped at 1", () => {
    expect(rmsLevel([])).toBe(0);
    expect(rmsLevel(new Float32Array(128))).toBe(0);
    const quiet = rmsLevel(new Float32Array(128).fill(0.02));
    const loud = rmsLevel(new Float32Array(128).fill(0.15));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(rmsLevel(new Float32Array(128).fill(1))).toBe(1);
  });
});

describe("TutorOrb", () => {
  it("shows the call state and the tutor's style", () => {
    const audioRef = createRef<HTMLAudioElement>();
    const { rerender } = render(<TutorOrb tutor="matt" status="connecting" audioRef={audioRef} />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(screen.getByTestId("tutor-orb").dataset["tutor"]).toBe("matt");
    rerender(<TutorOrb tutor="matt" status="connected" audioRef={audioRef} />);
    expect(screen.queryByText("Connecting…")).not.toBeInTheDocument();
  });
});
