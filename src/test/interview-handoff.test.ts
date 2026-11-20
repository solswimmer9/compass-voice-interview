import { describe, expect, it } from "vitest";
import { autoStartAction, shouldHandOffToFeedback } from "@/lib/interview-handoff";

const base = { accountLoading: false, signedIn: true, totalRemaining: 1, previewBrowser: false };

describe("interview start", () => {
  it("waits for the account before deciding", () => {
    expect(autoStartAction({ ...base, accountLoading: true, signedIn: false })).toBe("wait");
  });
  it("sends a signed-out visitor to sign in", () => {
    expect(autoStartAction({ ...base, signedIn: false })).toBe("sign-in");
  });
  it("stays put with no interviews left", () => {
    expect(autoStartAction({ ...base, totalRemaining: 0 })).toBe("out-of-credits");
  });
  it("starts when signed in with interviews left, or when the count has not arrived", () => {
    expect(autoStartAction(base)).toBe("start");
    expect(autoStartAction({ ...base, totalRemaining: undefined })).toBe("start");
  });
  it("lets the preview browser hint show the room, never the sign-in step", () => {
    expect(autoStartAction({ ...base, totalRemaining: 0, previewBrowser: true })).toBe("start");
    expect(autoStartAction({ ...base, signedIn: false, previewBrowser: true })).toBe("sign-in");
  });
});

describe("interview finish", () => {
  const done = {
    callStatus: "closed",
    alreadyHandedOff: false,
    startedHere: true,
    lineCount: 4,
    interviewId: "abc",
  };
  it("goes to feedback when a started call closes with something said", () => {
    expect(shouldHandOffToFeedback(done)).toBe(true);
  });
  it.each([
    ["still connected", { callStatus: "connected" }],
    ["already handed off", { alreadyHandedOff: true }],
    ["not started on this page", { startedHere: false }],
    ["nothing said", { lineCount: 0 }],
    ["no interview id", { interviewId: null }],
  ])("does not hand off when %s", (_name, override) => {
    expect(shouldHandOffToFeedback({ ...done, ...override })).toBe(false);
  });
});
