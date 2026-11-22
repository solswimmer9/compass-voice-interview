import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FeedbackLetter } from "@/components/FeedbackLetter";
import { letterBlocks, letterText } from "@/lib/feedback/argument-map";

const tutor = { name: "Dr River", initials: "DR" };
const body = "## What went well\n\nA **clear claim**.\n\n- Define terms.\n\n1. Practise.";

afterEach(() => vi.useRealTimers());

describe("feedback letter", () => {
  it("offers download and copy only once the letter is finished", () => {
    const { rerender } = render(<FeedbackLetter tutor={tutor} body={body} writing />);
    expect(screen.queryByRole("button", { name: "Download letter" })).toBeNull();

    rerender(<FeedbackLetter tutor={tutor} body={body} writing={false} />);
    expect(screen.getByRole("button", { name: "Download letter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy letter" })).toBeTruthy();
  });

  it("hides download and copy when writing failed partway", () => {
    render(<FeedbackLetter tutor={tutor} body={body} writing={false} failed />);
    expect(screen.queryByRole("button", { name: "Download letter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy letter" })).toBeNull();
  });

  it("says so when copying fails, then resets", async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<FeedbackLetter tutor={tutor} body={body} writing={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy letter" })));
    expect(screen.getByText(/Copying didn't work here/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText(/Copying didn't work here/)).toBeNull();
  });

  it("builds a plain-text copy without Markdown marks", () => {
    expect(letterText("Dear Ada,", letterBlocks(body), "Dr River", "22 November 2026")).toBe(
      "22 November 2026\n\nDear Ada,\n\nWhat went well\n\nA clear claim.\n\n- Define terms.\n\n1. Practise.\n\nWith best wishes,\nDr River\n",
    );
  });
});
