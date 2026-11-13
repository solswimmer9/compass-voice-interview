import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { LiveRoom } from "@/components/LiveRoom";

function room(overrides: Partial<Parameters<typeof LiveRoom>[0]> = {}) {
  return (
    <LiveRoom
      tutor="matt"
      tutorName="Prof Matt"
      subjectLabel="PPE · Prof Matt"
      objectMode={false}
      status="connected"
      audioRef={createRef<HTMLAudioElement>()}
      line={{ role: "assistant", text: "Why should anyone bother turning up?", key: 1 }}
      clock="1:05 / 20:00"
      muted={false}
      onToggleMute={() => {}}
      onEnd={() => {}}
      playbackBlocked={false}
      onResumePlayback={() => {}}
      error={null}
      {...overrides}
    />
  );
}

describe("live room", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens at the top and closes cleanly when scrollTo returns a promise (current Chrome)", () => {
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation((() => Promise.resolve()) as unknown as typeof window.scrollTo);
    const { unmount } = render(room());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(() => unmount()).not.toThrow();
  });

  it("shows the subject, the caption, the clock and the controls", () => {
    render(room());
    expect(screen.getByText("PPE · Prof Matt")).toBeTruthy();
    expect(screen.getByLabelText("Prof Matt: Why should anyone bother turning up?")).toBeTruthy();
    expect(screen.getByText("1:05 / 20:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "End" })).toBeTruthy();
  });

  it("labels an object interview and shows the chart beside the orb", () => {
    render(room({ objectMode: true, object: <figure>chart</figure> }));
    expect(screen.getByText("Object interview")).toBeTruthy();
    expect(screen.getByText("chart")).toBeTruthy();
  });
});
