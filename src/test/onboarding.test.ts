import { afterEach, describe, expect, it } from "vitest";
import {
  hasChosenSubject,
  parseInterviewChoice,
  rememberChoiceForSignIn,
  takeChoiceAfterSignIn,
} from "@/lib/interview-choice";
import { microphoneErrorMessage } from "@/lib/mic-error";

describe("interview choice", () => {
  afterEach(() => sessionStorage.clear());

  it("keeps only known values from the address", () => {
    expect(parseInterviewChoice({ tutor: "ppe", mode: "object", reading: "r1" })).toEqual({
      tutor: "ppe",
      mode: "object",
      reading: "r1",
    });
    expect(parseInterviewChoice({ tutor: "geography" })).toEqual({ tutor: "geography" });
    expect(parseInterviewChoice({ tutor: "xyz", mode: "evil", reading: 3 })).toEqual({});
  });

  it("counts a subject, a reading or an object link as a choice, and nothing else", () => {
    expect(hasChosenSubject({})).toBe(false);
    expect(hasChosenSubject({ tutor: "geography" })).toBe(true);
    expect(hasChosenSubject({ reading: "r1" })).toBe(true);
    expect(hasChosenSubject({ mode: "object" })).toBe(true);
  });

  it("remembers the choice across a sign-in that leaves the site, once", () => {
    rememberChoiceForSignIn({ tutor: "ppe", mode: "object" });
    expect(takeChoiceAfterSignIn()).toEqual({ tutor: "ppe", mode: "object" });
    expect(takeChoiceAfterSignIn()).toBeNull();
  });

  it("forgets an old choice when signing in without one, and ignores tampered storage", () => {
    rememberChoiceForSignIn({ tutor: "ppe" });
    rememberChoiceForSignIn({});
    expect(takeChoiceAfterSignIn()).toBeNull();
    sessionStorage.setItem("oxbridge.interviewChoice", '{"tutor":"admin","mode":"free"}');
    expect(takeChoiceAfterSignIn()).toBeNull();
    sessionStorage.setItem("oxbridge.interviewChoice", "not json");
    expect(takeChoiceAfterSignIn()).toBeNull();
  });
});

describe("microphone errors", () => {
  const named = (name: string) => Object.assign(new Error("raw browser text"), { name });

  it("explains a blocked, missing or busy microphone in plain English", () => {
    expect(microphoneErrorMessage(named("NotAllowedError"))).toMatch(/blocked the microphone/);
    expect(microphoneErrorMessage(named("NotFoundError"))).toMatch(/No microphone was found/);
    expect(microphoneErrorMessage(named("NotReadableError"))).toMatch(/another app/);
  });

  it("keeps other errors' own messages", () => {
    expect(microphoneErrorMessage(new Error("Please sign in again"))).toBe("Please sign in again");
    expect(microphoneErrorMessage("odd")).toBe("Microphone startup failed");
  });
});
