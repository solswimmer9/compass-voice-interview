import { describe, expect, it } from "vitest";
import { renderMemory } from "@/content/memory";
import { findSlop } from "@/lib/feedback/slop";
import type { VerifiedObservation } from "@/lib/feedback/verify-quotes";
import {
  describeForStudent,
  emptyStudentContext,
  expireObservations,
  interviewsAfter,
  startingDifficulty,
  toStudentMemory,
  updateStudentContext,
} from "@/lib/interview/student-context";
import type { StudentContext } from "@/lib/interview/types";

const obs = (over: Partial<VerifiedObservation> = {}): VerifiedObservation => ({
  id: "o1",
  criterionId: "scale",
  kind: "strength",
  claim: "Moved from a single street to the national picture when asked to change scale.",
  evidence: [{ turn: 4, quote: "if you zoom out the whole region changes" }],
  ...over,
});

const base = (over: Partial<Parameters<typeof updateStudentContext>[1]> = {}) => ({
  subjectId: "geography",
  interviewId: "i1",
  at: "2026-09-01T10:00:00.000Z",
  cardIds: ["river-person"],
  verified: [obs()],
  sustainedDifficulty: 3 as const,
  ...over,
});

describe("updateStudentContext", () => {
  it("creates a context from nothing, keeping evidence links", () => {
    const { context, rejected } = updateStudentContext(null, base());
    expect(rejected).toEqual([]);
    expect(context.subjectId).toBe("geography");
    expect(context.interviews).toBe(1);
    expect(context.sustainedDifficulty).toBe(3);
    expect(context.cardsDone).toEqual([{ id: "river-person", at: "2026-09-01T10:00:00.000Z" }]);
    expect(context.observations).toEqual([
      {
        criterionId: "scale",
        kind: "demonstrated",
        note: "Moved from a single street to the national picture when asked to change scale.",
        evidence: [
          { interviewId: "i1", turn: 4, quote: "if you zoom out the whole region changes" },
        ],
        lastSeen: "2026-09-01T10:00:00.000Z",
      },
    ]);
  });

  it("maps improvement to to_develop and rejects an observation with no evidence", () => {
    const { context, rejected } = updateStudentContext(
      null,
      base({
        verified: [
          obs({ id: "a", kind: "improvement", criterionId: "evidence" }),
          obs({ id: "b", evidence: [] }),
          obs({ id: "c", evidence: [{ turn: 2, quote: "   " }] }),
        ],
      }),
    );
    expect(context.observations).toHaveLength(1);
    expect(context.observations[0]?.kind).toBe("to_develop");
    expect(rejected.map((r) => r.observationId)).toEqual(["b", "c"]);
    expect(rejected[0]?.reason).toBe("no evidence");
  });

  it("does not store knowledge gaps as reasoning observations", () => {
    const { context, rejected } = updateStudentContext(
      null,
      base({ verified: [obs({ id: "k", kind: "knowledge_gap" })] }),
    );
    expect(context.observations).toHaveLength(0);
    expect(rejected[0]?.reason).toMatch(/knowledge gap/);
  });

  it("caps notes at 20 words", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const { context } = updateStudentContext(null, base({ verified: [obs({ claim: long })] }));
    expect(context.observations[0]?.note.split(" ")).toHaveLength(20);
  });

  it("merges a repeat of the same criterion and kind, refreshing lastSeen and the note", () => {
    const first = updateStudentContext(null, base()).context;
    const second = updateStudentContext(
      first,
      base({
        interviewId: "i2",
        at: "2026-10-01T10:00:00.000Z",
        cardIds: ["town-vote"],
        verified: [
          obs({
            claim: "Changed scale unprompted.",
            evidence: [{ turn: 9, quote: "at a national level it flips" }],
          }),
        ],
        sustainedDifficulty: 4,
      }),
    ).context;
    expect(second.interviews).toBe(2);
    expect(second.sustainedDifficulty).toBe(4);
    expect(second.cardsDone.map((c) => c.id)).toEqual(["river-person", "town-vote"]);
    expect(second.observations).toHaveLength(1);
    const o = second.observations[0];
    expect(o?.note).toBe("Changed scale unprompted.");
    expect(o?.lastSeen).toBe("2026-10-01T10:00:00.000Z");
    expect(o?.evidence.map((e) => e.interviewId)).toEqual(["i1", "i2"]);
  });

  it("keeps the same criterion as separate entries for different kinds", () => {
    const first = updateStudentContext(null, base()).context;
    const second = updateStudentContext(
      first,
      base({ interviewId: "i2", verified: [obs({ kind: "improvement" })] }),
    ).context;
    expect(second.observations.map((o) => o.kind).sort()).toEqual(["demonstrated", "to_develop"]);
  });

  it("does not mutate the previous context", () => {
    const first = updateStudentContext(null, base()).context;
    const snapshot = JSON.stringify(first);
    updateStudentContext(
      first,
      base({ interviewId: "i2", verified: [obs({ claim: "Different." })] }),
    );
    expect(JSON.stringify(first)).toBe(snapshot);
  });

  it("is per subject only", () => {
    const geo = updateStudentContext(null, base()).context;
    expect(() => updateStudentContext(geo, base({ subjectId: "law" }))).toThrow(/per subject/);
    expect(updateStudentContext(null, base({ subjectId: "law" })).context.subjectId).toBe("law");
  });

  it("keeps at most five pieces of evidence, newest last", () => {
    let ctx: StudentContext | null = null;
    for (let i = 1; i <= 7; i++) {
      ctx = updateStudentContext(
        ctx,
        base({
          interviewId: `i${i}`,
          verified: [obs({ evidence: [{ turn: i, quote: `quote number ${i} here` }] })],
        }),
      ).context;
    }
    expect(ctx?.observations[0]?.evidence.map((e) => e.interviewId)).toEqual([
      "i3",
      "i4",
      "i5",
      "i6",
      "i7",
    ]);
  });
});

describe("expireObservations", () => {
  const make = (): StudentContext => ({
    subjectId: "geography",
    interviews: 4,
    cardsDone: [],
    sustainedDifficulty: 2,
    observations: [
      {
        criterionId: "a",
        kind: "demonstrated",
        note: "strong point",
        evidence: [{ interviewId: "i1", turn: 1, quote: "q q q q" }],
        lastSeen: "2025-01-01T00:00:00.000Z",
      },
      {
        criterionId: "b",
        kind: "to_develop",
        note: "develop point",
        evidence: [{ interviewId: "i1", turn: 2, quote: "q q q q" }],
        lastSeen: "2026-09-01T00:00:00.000Z",
      },
      {
        criterionId: "c",
        kind: "misconception",
        note: "misconception point",
        evidence: [{ interviewId: "i1", turn: 3, quote: "q q q q" }],
        lastSeen: "2026-09-01T00:00:00.000Z",
      },
    ],
  });
  const now = new Date("2026-09-20T00:00:00.000Z");

  it("keeps everything when recent and few interviews have passed", () => {
    const { context, expired } = expireObservations(make(), { now, interviewsSince: 2 });
    expect(context.observations).toHaveLength(3);
    expect(expired).toEqual([]);
  });

  it("expires to_develop and misconception after three later interviews, never demonstrated", () => {
    const { context, expired } = expireObservations(make(), { now, interviewsSince: 3 });
    expect(context.observations.map((o) => o.criterionId)).toEqual(["a"]);
    expect(expired.map((o) => o.criterionId)).toEqual(["b", "c"]);
  });

  it("expires by age at 90 days, not before", () => {
    const early = expireObservations(make(), {
      now: new Date("2026-11-28T00:00:00.000Z"),
      interviewsSince: 0,
    });
    expect(early.context.observations).toHaveLength(3); // 88 days
    const late = expireObservations(make(), {
      now: new Date("2026-11-30T00:00:00.000Z"),
      interviewsSince: 0,
    });
    expect(late.context.observations.map((o) => o.criterionId)).toEqual(["a"]); // 90 days
  });

  it("keeps an observation that was seen again", () => {
    const old = make();
    const reseen = updateStudentContext(old, {
      subjectId: "geography",
      interviewId: "i9",
      at: "2026-11-25T00:00:00.000Z",
      cardIds: [],
      verified: [obs({ criterionId: "b", kind: "improvement", claim: "Still develop point." })],
      sustainedDifficulty: 2,
    }).context;
    const { context } = expireObservations(reseen, {
      now: new Date("2026-11-30T00:00:00.000Z"),
      interviewsSince: interviewsAfter([
        "2026-09-10T00:00:00.000Z",
        "2026-10-10T00:00:00.000Z",
        "2026-11-01T00:00:00.000Z",
        "2026-11-25T00:00:00.000Z",
      ]),
    });
    const kept = context.observations.map((o) => o.criterionId);
    expect(kept).toContain("b"); // seen on 25 Nov: 0 later interviews, 5 days
    expect(kept).not.toContain("c"); // last seen 1 Sep: later interviews and over 90 days
  });

  it("counts interviews after a date with interviewsAfter", () => {
    const f = interviewsAfter([
      "2026-09-02T00:00:00.000Z",
      "2026-09-05T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ]);
    expect(f("2026-09-01T00:00:00.000Z")).toBe(3);
    expect(f("2026-09-05T00:00:00.000Z")).toBe(1);
    expect(f("2026-10-02T00:00:00.000Z")).toBe(0);
    const { expired } = expireObservations(make(), { now, interviewsSince: f });
    expect(expired.map((o) => o.criterionId)).toEqual(["b", "c"]);
  });
});

describe("startingDifficulty", () => {
  it("defaults to 2 and otherwise uses the sustained level", () => {
    expect(startingDifficulty(null)).toBe(2);
    expect(startingDifficulty(undefined)).toBe(2);
    expect(startingDifficulty(emptyStudentContext("law"))).toBe(2);
    const ctx = { ...emptyStudentContext("law"), sustainedDifficulty: 4 as const };
    expect(startingDifficulty(ctx)).toBe(4);
    expect(startingDifficulty({ ...ctx, sustainedDifficulty: 1 })).toBe(1);
  });

  it("is never higher than the sustained level, even for a bad stored value", () => {
    const ctx = { ...emptyStudentContext("law"), sustainedDifficulty: 9 as never };
    expect(startingDifficulty(ctx)).toBe(4);
  });
});

describe("toStudentMemory", () => {
  const ctx = (): StudentContext => {
    let c: StudentContext | null = null;
    c = updateStudentContext(
      c,
      base({
        cardIds: ["river-person"],
        verified: [
          obs({ id: "1", criterionId: "s1", claim: "Switched scale well." }),
          obs({ id: "2", criterionId: "s2", claim: "Gave a clear example." }),
        ],
      }),
    ).context;
    c = updateStudentContext(
      c,
      base({
        interviewId: "i2",
        at: "2026-10-01T00:00:00.000Z",
        cardIds: ["town-vote"],
        verified: [
          obs({
            id: "3",
            kind: "improvement",
            criterionId: "d1",
            claim: "Conceded when challenged.",
          }),
          obs({
            id: "4",
            kind: "improvement",
            criterionId: "d2",
            claim: "Treated the region as uniform.",
          }),
        ],
      }),
    ).context;
    return c;
  };

  it("converts to the existing StudentMemory shape", () => {
    const m = toStudentMemory(ctx());
    expect(m.interviews).toBe(2);
    expect(m.cardsDone.map((c) => c.id)).toEqual(["river-person", "town-vote"]);
    expect(m.strengths).toEqual(["Switched scale well.", "Gave a clear example."]);
    expect(m.habits).toEqual(["Conceded when challenged.", "Treated the region as uniform."]);
    expect(m.nextFocus).toBe("Conceded when challenged.");
    for (const item of [...m.strengths, ...m.habits])
      expect(item.split(" ").length).toBeLessThanOrEqual(20);
  });

  it("caps each list at three and handles an empty context", () => {
    let c: StudentContext | null = null;
    for (let i = 0; i < 5; i++) {
      c = updateStudentContext(
        c,
        base({
          interviewId: `i${i}`,
          at: `2026-09-0${i + 1}T00:00:00.000Z`,
          verified: [obs({ id: `${i}`, criterionId: `s${i}`, claim: `Point ${i}.` })],
        }),
      ).context;
    }
    expect(toStudentMemory(c as StudentContext).strengths).toHaveLength(3);
    expect(toStudentMemory(c as StudentContext).strengths[0]).toBe("Point 4.");
    const empty = toStudentMemory(emptyStudentContext("law"));
    expect(empty).toEqual({
      interviews: 0,
      cardsDone: [],
      strengths: [],
      habits: [],
      nextFocus: "",
    });
    expect(renderMemory(empty)).toBe("");
  });

  it("works unchanged with renderMemory", () => {
    const text = renderMemory(toStudentMemory(ctx()));
    expect(text).toContain("Third interview");
    expect(text).toContain("Conceded when challenged");
    expect(text).toContain("Switched scale well");
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(80);
  });
});

describe("describeForStudent", () => {
  const ctx = (): StudentContext =>
    updateStudentContext(
      null,
      base({
        verified: [
          obs({ id: "1", claim: "Changed scale when asked and kept the argument." }),
          obs({
            id: "2",
            kind: "improvement",
            criterionId: "evidence",
            claim: "Gave a view without an example to back it.",
            evidence: [{ turn: 6, quote: "it just is like that really" }],
          }),
        ],
      }),
    ).context;

  it("is second person, plain, quotes the student and says how it is used", () => {
    const text = describeForStudent(ctx());
    expect(text).toContain("your 1 geography interview");
    expect(text).toContain(
      "Something you did well: Changed scale when asked and kept the argument.",
    );
    expect(text).toContain('You said: "if you zoom out the whole region changes"');
    expect(text).toContain(
      "Something to practise next time: Gave a view without an example to back it.",
    );
    expect(text).toMatch(/delete all of it at any time/);
    expect(text).toMatch(/only to choose your questions/);
  });

  it("contains no banned labelling, scores or predictions", () => {
    expect(findSlop(describeForStudent(ctx()))).toEqual([]);
    expect(findSlop(describeForStudent(emptyStudentContext("law")))).toEqual([]);
    const text = describeForStudent(ctx());
    expect(text).not.toMatch(
      /you are (a|an|the|very|quite)\b|you lack|natural|talent|weak student|\d\s*\/\s*10|chances/i,
    );
  });

  it("leaves out a note that would label the person", () => {
    const c = updateStudentContext(
      null,
      base({
        verified: [
          obs({ id: "1", claim: "You lack confidence when challenged." }),
          obs({ id: "2", criterionId: "b", claim: "Held the argument after a counterexample." }),
        ],
      }),
    ).context;
    const text = describeForStudent(c);
    expect(text).not.toMatch(/lack confidence/);
    expect(text).toContain("Held the argument after a counterexample.");
    expect(findSlop(text)).toEqual([]);
  });

  it("says plainly when there is nothing yet", () => {
    expect(describeForStudent(emptyStudentContext("law"))).toMatch(
      /no notes from earlier law interviews yet/,
    );
    const faded = expireObservations(ctx(), {
      now: new Date("2027-06-01T00:00:00.000Z"),
      interviewsSince: 0,
    }).context;
    expect(describeForStudent(faded)).toContain("Something you did well");
  });
});
