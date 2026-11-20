import { describe, expect, it } from "vitest";
import { autoStartAction, shouldHandOffToFeedback } from "@/lib/interview-handoff";

const base = {
  accountLoading: false,
  guestUsedUp: false,
  outOfInterviews: false,
  previewBrowser: false,
};

describe("interview start", () => {
  it("waits for the account before deciding", () => {
    expect(autoStartAction({ ...base, accountLoading: true, guestUsedUp: true })).toBe("wait");
  });
  it("starts for a signed-out visitor or a signed-in student with interviews left", () => {
    expect(autoStartAction(base)).toBe("start");
  });
  it("sends a guest who has used their free tries to sign in", () => {
    expect(autoStartAction({ ...base, guestUsedUp: true, outOfInterviews: true })).toBe("sign-in");
  });
  it("stays put, offering to buy more, when a student has none left", () => {
    expect(autoStartAction({ ...base, outOfInterviews: true })).toBe("out-of-interviews");
  });
  it("lets the preview browser hint show the room, never skip the sign-in step", () => {
    expect(autoStartAction({ ...base, outOfInterviews: true, previewBrowser: true })).toBe("start");
    expect(
      autoStartAction({ ...base, guestUsedUp: true, outOfInterviews: true, previewBrowser: true }),
    ).toBe("sign-in");
  });
});

describe("interview finish", () => {
  const done = {
    callStatus: "closed",
    alreadyHandedOff: false,
    startedHere: true,
    canReconnect: false,
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
    ["the call dropped and can be resumed", { canReconnect: true }],
    ["nothing said", { lineCount: 0 }],
    ["no interview id", { interviewId: null }],
  ])("does not hand off when %s", (_name, override) => {
    expect(shouldHandOffToFeedback({ ...done, ...override })).toBe(false);
  });
});
