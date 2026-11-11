import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  LEADING_PATTERNS,
  checkThresholds,
  compareRuns,
  countSentences,
  findLeadingPatterns,
  groupTurns,
  interviewMetrics,
  refersToPrevious,
  type TimedTurn,
  type TranscriptDelta,
} from "@/lib/evals/metrics";
import { SCRIPTED_STUDENTS } from "@/lib/evals/scripted-students";
import {
  COMMITMENTS,
  EVAL_KIT_VERSION,
  buildJudgePrompt,
  judgeVerdictSchema,
} from "@/lib/evals/judge";

const d = (role: "user" | "assistant", text: string, s: number, e: number): TranscriptDelta => ({
  role,
  text,
  start_ms: s,
  end_ms: e,
});

describe("groupTurns", () => {
  it("merges consecutive same-role deltas and numbers turns from 1", () => {
    const t = groupTurns([
      d("assistant", "Why do rivers meander?", 0, 2000),
      d("assistant", "Take your time.", 2000, 3000),
      d("user", "Erosion on the outer bank", 4000, 6000),
      d("user", "and deposition inside.", 6000, 7000),
      d("assistant", "Go on.", 8000, 8500),
    ]);
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({ turn: 1, role: "assistant", start_ms: 0, end_ms: 3000 });
    expect(t[1]).toMatchObject({
      turn: 2,
      text: "Erosion on the outer bank and deposition inside.",
      start_ms: 4000,
      end_ms: 7000,
    });
    expect(t[2]!.turn).toBe(3);
  });
  it("skips empty deltas and tolerates bad input", () => {
    expect(groupTurns([])).toEqual([]);
    expect(groupTurns([d("user", "  ", 0, 1)])).toEqual([]);
    expect(groupTurns(undefined as unknown as TranscriptDelta[])).toEqual([]);
    const t = groupTurns([d("user", "hi", NaN, NaN)]);
    expect(t[0]).toMatchObject({ start_ms: 0, end_ms: 0 });
  });
});

describe("helpers", () => {
  it("counts sentences", () => {
    expect(countSentences("")).toBe(0);
    expect(countSentences("No punctuation here")).toBe(1);
    expect(countSentences("One. Two? Three! Four.")).toBe(4);
    expect(countSentences("Wait... what?")).toBe(2);
  });
  it("finds leading patterns", () => {
    expect(LEADING_PATTERNS.length).toBeGreaterThan(5);
    expect(findLeadingPatterns("So wouldn't you say it is political?")).toContain(
      "wouldnt-you-say",
    );
    expect(findLeadingPatterns("Don't you think that follows?")).toContain("dont-you-think");
    expect(findLeadingPatterns("Surely that can't be right.")).toContain("surely");
    expect(findLeadingPatterns("So you agree with the premise.")).toContain("so-you-agree");
    expect(findLeadingPatterns("That is a border, isn't it?")).toContain("isnt-it");
    expect(findLeadingPatterns("It floods in spring, right?")).toContain("tag-question");
    expect(findLeadingPatterns("What would you expect to see if that were true?")).toEqual([]);
  });
  it("detects reference by shared content word", () => {
    expect(
      refersToPrevious("Why does erosion matter there?", "Because erosion is faster outside"),
    ).toBe(true);
    expect(refersToPrevious("What about deposition?", "I think it is about erosion")).toBe(false);
    // stopwords and short words do not count
    expect(refersToPrevious("Why do you think that?", "Maybe I think so, really")).toBe(false);
    // simple plural stem
    expect(refersToPrevious("Which meanders form first?", "The meander moves downstream")).toBe(
      true,
    );
  });
});

const mk = (rows: ["user" | "assistant", string, number, number][]): TimedTurn[] =>
  groupTurns(rows.map(([r, t, s, e]) => d(r, t, s, e)));

describe("interviewMetrics", () => {
  const turns = mk([
    ["assistant", "Why might a river change course?", 0, 2000],
    ["user", "Erosion on the outer bank makes the meander migrate.", 3000, 6000],
    [
      "assistant",
      "What would stop the meander migrating? What happens at the neck? Is that stable? Why?",
      6500,
      10000,
    ],
    ["user", "A cutoff forms and leaves an oxbow lake.", 12000, 14000],
    ["assistant", "So wouldn't you say rivers are fragile?", 13000, 15000],
    ["user", "Not really, floods reshape channels often.", 16000, 18000],
    ["assistant", "Tell me about something different.", 20000, 21000],
  ]);
  const m = interviewMetrics(turns);

  it("counts turns and duration", () => {
    expect(m.turnCount).toBe(7);
    expect(m.tutorTurnCount).toBe(4);
    expect(m.studentTurnCount).toBe(3);
    expect(m.durationMs).toBe(21000);
  });
  it("computes talk share by words", () => {
    expect(m.tutorWords).toBe(33);
    expect(m.studentWords).toBe(9 + 8 + 6);
    expect(m.tutorTalkShare).toBeCloseTo(m.tutorWords / (m.tutorWords + m.studentWords));
    expect(m.tutorTalkShare).toBeGreaterThan(0.5);
  });
  it("flags long and multi-question turns", () => {
    expect(m.longTutorTurns).toBe(1);
    expect(m.longTutorTurnShare).toBeCloseTo(0.25);
    expect(m.multiQuestionTutorTurns).toBe(1);
    expect(m.multiQuestionShare).toBeCloseTo(0.25);
  });
  it("measures references over tutor turns that follow a student turn", () => {
    expect(m.tutorTurnsWithPrecedingStudent).toBe(3);
    // turn 3 shares "meander", turn 5 shares "rivers"? student said "oxbow/lake/forms/cutoff": no. turn 7: none.
    expect(m.referringTutorTurns).toBe(1);
    expect(m.referenceShare).toBeCloseTo(1 / 3);
  });
  it("finds leading candidates", () => {
    expect(m.leadingTurns).toEqual([5]);
    expect(m.leadingShare).toBeCloseTo(0.25);
  });
  it("counts interruptions and gaps", () => {
    expect(m.interruptions).toBe(1); // turn 5 starts at 13000 before student ends at 14000
    // gaps: 500 (turn 3), 2000 (turn 7)
    expect(m.gapMedianMs).toBe(1250);
    expect(m.gapP90Ms).toBeCloseTo(1850);
  });
});

describe("interviewMetrics edge cases", () => {
  it("handles empty transcript without NaN", () => {
    const m = interviewMetrics([]);
    expect(m.turnCount).toBe(0);
    expect(m.durationMs).toBe(0);
    for (const k of [
      "tutorTalkShare",
      "longTutorTurnShare",
      "multiQuestionShare",
      "referenceShare",
      "leadingShare",
    ] as const)
      expect(m[k]).toBe(0);
    expect(m.gapMedianMs).toBeNull();
    expect(m.gapP90Ms).toBeNull();
    expect(() => interviewMetrics(undefined as unknown as TimedTurn[])).not.toThrow();
  });
  it("handles a single tutor turn and a single student turn", () => {
    const one = interviewMetrics(mk([["assistant", "Why do rivers meander?", 0, 1000]]));
    expect(one.tutorTalkShare).toBe(1);
    expect(one.tutorTurnsWithPrecedingStudent).toBe(0);
    expect(one.referenceShare).toBe(0);
    expect(one.gapMedianMs).toBeNull();
    const stu = interviewMetrics(mk([["user", "Hello there", 0, 1000]]));
    expect(stu.tutorTalkShare).toBe(0);
    expect(stu.tutorTurnCount).toBe(0);
    expect(stu.longTutorTurnShare).toBe(0);
  });
  it("treats a gap of exactly zero as no interruption", () => {
    const m = interviewMetrics(
      mk([
        ["user", "Erosion here", 0, 1000],
        ["assistant", "Why erosion?", 1000, 2000],
      ]),
    );
    expect(m.interruptions).toBe(0);
    expect(m.gapMedianMs).toBe(0);
  });
});

describe("checkThresholds", () => {
  const good = interviewMetrics(
    mk([
      ["assistant", "Why might a river change course?", 0, 1000],
      [
        "user",
        "Erosion on the outer bank makes meanders migrate downstream and speak at length about it today.",
        2000,
        5000,
      ],
      ["assistant", "What does erosion do to the inner bank?", 5500, 6500],
      [
        "user",
        "Deposition builds a point bar there with slower water flow and sediment settling out steadily.",
        7000,
        9000,
      ],
    ]),
  );
  it("uses the documented defaults", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      leadingShareMax: 0.05,
      longTutorTurnShareMax: 0.1,
      referenceShareMin: 0.7,
      tutorTalkShareMax: 0.4,
    });
  });
  it("passes a healthy interview", () => {
    const r = checkThresholds(good);
    expect(r.results.map((x) => x.measure)).toEqual([
      "leadingShare",
      "longTutorTurnShare",
      "referenceShare",
      "tutorTalkShare",
    ]);
    expect(r.results.every((x) => x.pass === true)).toBe(true);
    expect(r.passed).toBe(true);
  });
  it("fails each measure independently", () => {
    const bad = {
      ...good,
      leadingShare: 0.06,
      longTutorTurnShare: 0.11,
      referenceShare: 0.69,
      tutorTalkShare: 0.4,
    };
    const r = checkThresholds(bad);
    expect(r.results.map((x) => x.pass)).toEqual([false, false, false, false]);
    expect(r.passed).toBe(false);
    const edge = checkThresholds({
      ...good,
      leadingShare: 0.05,
      longTutorTurnShare: 0.1,
      referenceShare: 0.7,
      tutorTalkShare: 0.39,
    });
    expect(edge.passed).toBe(true);
  });
  it("reports null (not a failure) when nothing is measurable", () => {
    const r = checkThresholds(interviewMetrics([]));
    expect(r.results.every((x) => x.pass === null)).toBe(true);
    expect(r.passed).toBe(true);
    const only = checkThresholds(
      interviewMetrics(mk([["assistant", "Opening question here?", 0, 1]])),
    );
    expect(only.results.find((x) => x.measure === "referenceShare")!.pass).toBeNull();
  });
  it("accepts custom thresholds", () => {
    const r = checkThresholds(good, { ...DEFAULT_THRESHOLDS, tutorTalkShareMax: 0.01 });
    expect(r.passed).toBe(false);
  });
});

describe("compareRuns", () => {
  const base = interviewMetrics([]);
  it("flags measures worse by 5 points or more", () => {
    const prev = { ...base, leadingShare: 0.02, referenceShare: 0.8, tutorTalkShare: 0.3 };
    const cur = { ...base, leadingShare: 0.07, referenceShare: 0.75, tutorTalkShare: 0.34 };
    const flags = compareRuns(prev, cur);
    expect(flags.map((f) => f.measure).sort()).toEqual(["leadingShare", "referenceShare"]);
    expect(flags.find((f) => f.measure === "leadingShare")!.worseBy).toBeCloseTo(0.05);
  });
  it("does not flag improvements or small moves", () => {
    const prev = { ...base, leadingShare: 0.1, referenceShare: 0.6 };
    const cur = { ...base, leadingShare: 0.0, referenceShare: 0.9 };
    expect(compareRuns(prev, cur)).toEqual([]);
    expect(
      compareRuns({ ...base, referenceShare: 0.7 }, { ...base, referenceShare: 0.66 }),
    ).toEqual([]);
  });
});

describe("scripted students and judge", () => {
  it("defines ten unique, populated, subject-neutral profiles", () => {
    expect(SCRIPTED_STUDENTS).toHaveLength(10);
    expect(new Set(SCRIPTED_STUDENTS.map((s) => s.id)).size).toBe(10);
    for (const s of SCRIPTED_STUDENTS) {
      expect(s.behaviourRules.length).toBeGreaterThan(0);
      expect(s.expectedTutorBehaviour.length).toBeGreaterThan(0);
    }
    const distressed = SCRIPTED_STUDENTS.find((s) => s.id === "distressed")!;
    expect(distressed.expectedTutorBehaviour.join(" ")).toMatch(/pause or stop/);
  });
  it("builds a judge prompt with numbered turns and expected behaviour", () => {
    const turns = [
      { turn: 1, role: "assistant" as const, text: "Why?" },
      { turn: 2, role: "user" as const, text: "Because." },
    ];
    const p = buildJudgePrompt({
      commitments: COMMITMENTS,
      transcriptTurns: turns,
      student: SCRIPTED_STUDENTS[0]!,
    });
    expect(p).toContain("[1] TUTOR: Why?");
    expect(p).toContain("[2] STUDENT: Because.");
    expect(p).toContain("11. Credible personality");
    expect(p).toContain(SCRIPTED_STUDENTS[0]!.expectedTutorBehaviour[0]!);
    expect(buildJudgePrompt({ transcriptTurns: [], student: SCRIPTED_STUDENTS[0]! })).toContain(
      "(empty transcript)",
    );
    expect(EVAL_KIT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("validates verdicts and requires evidence for a fail", () => {
    const ok = { commitments: [{ id: 1, verdict: "pass", evidenceTurns: [3], note: "ok" }] };
    expect(judgeVerdictSchema.safeParse(ok).success).toBe(true);
    const noEvidence = {
      commitments: [{ id: 7, verdict: "fail", evidenceTurns: [], note: "lectured" }],
    };
    expect(judgeVerdictSchema.safeParse(noEvidence).success).toBe(false);
    expect(
      judgeVerdictSchema.safeParse({
        commitments: [{ id: 12, verdict: "pass", evidenceTurns: [], note: "" }],
      }).success,
    ).toBe(false);
  });
});
