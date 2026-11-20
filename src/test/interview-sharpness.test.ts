// Owner's request, 20 November 2026: sharper follow-ups, and background noise must not stop the
// tutor. Both rules reach every tutor: the fixed Dr River prompt and card sessions (PPE, testers).
import { describe, expect, it } from "vitest";
import { FOLLOW_UP_POLICY, INTERRUPTION_POLICY, VOICE_POLICY } from "@/content/core";
import { conversationInstructions } from "@/lib/live-relay.server";
import { MICROPHONE_CONSTRAINTS } from "@/hooks/use-live-voice";

describe("sharper follow-ups and noise handling", () => {
  it("students on the fixed Dr River prompt get both rules", () => {
    expect(conversationInstructions).toContain(FOLLOW_UP_POLICY);
    expect(conversationInstructions).toContain(INTERRUPTION_POLICY);
  });

  it("card sessions (Prof Matt, tester Dr River) get both rules", () => {
    expect(VOICE_POLICY).toContain(FOLLOW_UP_POLICY);
    expect(VOICE_POLICY).toContain(INTERRUPTION_POLICY);
  });

  it("the old stop-on-any-sound rule is gone", () => {
    const old = "Stop speaking and listen when the candidate interrupts.";
    expect(conversationInstructions).not.toContain(old);
    expect(VOICE_POLICY).not.toContain(old);
  });

  it("follow-ups must test what the student just said, with no empty praise", () => {
    expect(FOLLOW_UP_POLICY).toMatch(/specific word, claim or example/);
    expect(FOLLOW_UP_POLICY).toMatch(/No praise/);
  });

  it("background sounds are not interruptions", () => {
    expect(INTERRUPTION_POLICY).toMatch(/Background sounds are not interruptions/);
  });

  it("the microphone filters noise before it reaches the tutor", () => {
    expect(MICROPHONE_CONSTRAINTS).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true,
    });
  });
});
