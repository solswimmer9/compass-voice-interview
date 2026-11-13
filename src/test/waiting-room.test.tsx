import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WaitingRoom } from "@/components/WaitingRoom";

describe("waiting room", () => {
  it("says the tutor is getting ready, shows errors, and can be cancelled", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const onCancel = vi.fn();
    render(
      <WaitingRoom
        tutor="river"
        tutorName="Dr River"
        subjectLabel="Geography · Dr River"
        audioRef={createRef<HTMLAudioElement>()}
        error="Microphone blocked"
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("heading", { name: "Dr River is getting ready…" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Microphone blocked");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
