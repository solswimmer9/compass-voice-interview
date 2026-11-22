import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackLetter } from "@/components/FeedbackLetter";
import { letterText } from "@/lib/feedback/argument-map";

const tutor = { name: "Dr River", initials: "DR" };

describe("feedback letter", () => {
  it("offers download and copy only once the letter is finished", () => {
    const { rerender } = render(
      <FeedbackLetter tutor={tutor} studentName="Ada Lovelace" body="Good start." writing />,
    );
    expect(screen.queryByRole("button", { name: "Download letter" })).toBeNull();

    rerender(
      <FeedbackLetter
        tutor={tutor}
        studentName="Ada Lovelace"
        body="Good start."
        writing={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Download letter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy letter" })).toBeTruthy();
  });

  it("builds a plain-text copy with date, greeting, body and sign-off", () => {
    expect(letterText("Dear Ada,", "  Good start.\n", "Dr River", "22 November 2026")).toBe(
      "22 November 2026\n\nDear Ada,\n\nGood start.\n\nWith best wishes,\nDr River\n",
    );
  });
});
