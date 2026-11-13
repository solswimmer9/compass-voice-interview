import { afterEach, describe, expect, it } from "vitest";
import {
  loadFinishedInterview,
  parseFinishedInterview,
  saveFinishedInterview,
  transcriptText,
  updateFinishedInterview,
} from "@/lib/finished-interview";

const interview = {
  interviewId: "abc",
  tutor: "ppe" as const,
  lines: [
    { role: "assistant" as const, text: "Is it fair? " },
    { role: "user" as const, text: "It depends." },
  ],
  cardIds: ["c1"],
  objectId: "uk-turnout",
};

describe("finished interview hand-off", () => {
  afterEach(() => sessionStorage.clear());

  it("carries the interview from the room to the feedback page", () => {
    saveFinishedInterview(interview);
    expect(loadFinishedInterview()).toEqual(interview);
  });

  it("formats the transcript as the feedback request expects", () => {
    expect(transcriptText(interview)).toBe("Prof Matt: Is it fair?\n\nYou: It depends.");
    expect(transcriptText({ ...interview, tutor: "geography" })).toMatch(/^Dr River: /u);
  });

  it("remembers that feedback was asked for, and the letter, for the same interview only", () => {
    saveFinishedInterview(interview);
    updateFinishedInterview("someone-else", { feedback: "nope" });
    expect(loadFinishedInterview()?.feedback).toBeUndefined();
    updateFinishedInterview("abc", { feedbackRequested: true });
    updateFinishedInterview("abc", { feedback: "Dear student" });
    expect(loadFinishedInterview()).toMatchObject({
      feedbackRequested: true,
      feedback: "Dear student",
    });
  });

  it("ignores anything malformed or unknown", () => {
    expect(parseFinishedInterview(null)).toBeNull();
    expect(parseFinishedInterview({ ...interview, tutor: "law" })).toBeNull();
    expect(parseFinishedInterview({ ...interview, interviewId: "" })).toBeNull();
    expect(parseFinishedInterview({ ...interview, lines: [{ role: "x", text: "y" }] })).toBeNull();
    expect(parseFinishedInterview({ ...interview, extra: "<script>" })).toEqual(interview);
    sessionStorage.setItem("oxbridge.finishedInterview", "{not json");
    expect(loadFinishedInterview()).toBeNull();
  });
});
