import { describe, expect, it, vi } from "vitest";
import { GEOGRAPHY_CRITERIA } from "@/lib/feedback/criteria";
import type { Turn } from "@/lib/feedback/types";
import { createLiveDirector, type LiveDirectorOptions } from "@/lib/interview/live-director";

const MINUTE = 60_000;

function turnState(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    turn: 2,
    phase: "opening",
    cardId: "unknown",
    skillTested: "assumptions",
    tutorMove: "clarify",
    studentEvidence: {
      gaveReason: true,
      usedExample: false,
      handledChallenge: "na",
      knowledgeGap: null,
      weakPattern: null,
    },
    tutorFlags: { leading: false, lectured: false, offTopic: false, ignoredStudent: false },
    transcriptUnclear: false,
    difficulty: 2,
    nextObjective: "Ask what evidence would decide it.",
    ...overrides,
  });
}

function turns(count: number): Turn[] {
  return Array.from({ length: count }, (_, index) => ({
    turn: index + 1,
    role: index % 2 === 0 ? ("assistant" as const) : ("user" as const),
    text: index % 2 === 0 ? "Who owns the outdoors?" : "Whoever paid for the land, I think.",
  }));
}

function director(overrides: Partial<LiveDirectorOptions> = {}) {
  const log = vi.fn();
  const sendNote = vi.fn();
  const analyse = vi.fn().mockResolvedValue(turnState());
  const live = createLiveDirector({
    minutes: 20,
    hasStimulus: false,
    criteria: GEOGRAPHY_CRITERIA,
    steer: false,
    analyse,
    sendNote,
    log,
    ...overrides,
  });
  return { live, log, sendNote, analyse };
}

describe("live director", () => {
  it("in shadow mode analyses each student turn and logs it, but never steers", async () => {
    const { live, log, sendNote, analyse } = director({ steer: false });
    live.studentTurnEnded(turns(2), 3 * MINUTE);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());

    expect(analyse).toHaveBeenCalledOnce();
    expect(analyse.mock.calls[0]?.[0]).toContain("<transcript>");
    expect(sendNote).not.toHaveBeenCalled();
    const entry = log.mock.calls[0]?.[0];
    expect(entry).toMatchObject({ event: "interview.turn", turn: 2, analysed: true });
    // The phase moved on because the student gave a reason in the opening.
    expect(entry.phase).not.toBe("opening");
    expect(entry).toMatchObject({ note: "phase", noteSent: false });
    // Logs carry labels, never what anyone said.
    expect(JSON.stringify(log.mock.calls)).not.toContain("Whoever paid");
  });

  it("sends the director's note to the tutor when steering is on", async () => {
    const { live, log, sendNote } = director({ steer: true });
    live.studentTurnEnded(turns(2), 3 * MINUTE);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());

    expect(sendNote).toHaveBeenCalledOnce();
    const note = sendNote.mock.calls[0]?.[0] as string;
    expect(note.length).toBeGreaterThan(0);
    expect(new TextEncoder().encode(note).length).toBeLessThan(480);
    expect(log.mock.calls[0]?.[0]).toMatchObject({ noteSent: true });
  });

  it("analyses one turn at a time and skips straight to the latest waiting turn", async () => {
    let release!: (text: string) => void;
    const analyse = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => (release = resolve)))
      .mockResolvedValue(turnState({ turn: 6 }));
    const { live, log } = director({ analyse });

    live.studentTurnEnded(turns(2), MINUTE);
    live.studentTurnEnded(turns(4), 2 * MINUTE);
    live.studentTurnEnded(turns(6), 3 * MINUTE);
    expect(analyse).toHaveBeenCalledTimes(1);

    release(turnState());
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2));
    expect(analyse).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.map(([entry]) => entry.turn)).toEqual([2, 6]);
  });

  it("never analyses the same student turn twice", async () => {
    const { live, log, analyse } = director();
    live.studentTurnEnded(turns(2), MINUTE);
    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    live.studentTurnEnded(turns(2), MINUTE);
    await Promise.resolve();
    expect(analyse).toHaveBeenCalledOnce();
  });

  it("keeps going on time alone when the analyst fails or returns nonsense", async () => {
    const analyse = vi
      .fn()
      .mockRejectedValueOnce(new Error("gateway down"))
      .mockResolvedValue("not json at all");
    const { live, log, sendNote } = director({ analyse, steer: true });

    live.studentTurnEnded(turns(2), MINUTE);
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
    live.studentTurnEnded(turns(4), 12 * MINUTE);
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(2));

    expect(log.mock.calls[0]?.[0]).toMatchObject({ analysed: false, failure: "Error" });
    expect(log.mock.calls[1]?.[0]).toMatchObject({ analysed: false, failure: "unparseable" });
    // Twelve minutes in, time alone has moved the interview past the opening phases.
    expect(["probing", "challenge"]).toContain(live.state.phase);
    expect(sendNote).toHaveBeenCalled();
  });

  it("stops analysing and drops waiting work once closed", async () => {
    let signal: AbortSignal | undefined;
    const analyse = vi.fn((_prompt: string, s: AbortSignal) => {
      signal = s;
      return new Promise<string>(() => {});
    });
    const { live, log } = director({ analyse });
    live.studentTurnEnded(turns(2), MINUTE);
    live.studentTurnEnded(turns(4), MINUTE);
    live.close();
    expect(signal?.aborted).toBe(true);
    live.studentTurnEnded(turns(6), MINUTE);
    await Promise.resolve();
    expect(analyse).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });
});
