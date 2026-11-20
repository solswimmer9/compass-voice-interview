import { describe, expect, it, vi } from "vitest";
import { COMMITMENTS } from "@/lib/evals/judge";
import { runEvals, summariseReport, type ChatFn } from "@/lib/evals/runner";
import { SCRIPTED_STUDENTS } from "@/lib/evals/scripted-students";

const tutor = {
  id: "geography",
  instructions: "You are Dr River.",
  opening: "Ask who owns the outdoors.",
  versions: { tutorVersion: "fixed-briefing" },
};
const student = SCRIPTED_STUDENTS[0]!;

function judgeReply(verdict: "pass" | "fail" | "not_applicable") {
  return JSON.stringify({
    commitments: COMMITMENTS.map(({ id }) => ({
      id,
      verdict,
      evidenceTurns: verdict === "fail" ? [1] : [],
      note: "",
    })),
    expectedBehaviour: [],
  });
}

describe("eval runner", () => {
  it("alternates tutor and student, giving each the other's lines as the other speaker", async () => {
    const tutorChat = vi.fn<ChatFn>().mockResolvedValue("Why do you think that, given footpaths?");
    const studentChat = vi.fn<ChatFn>().mockResolvedValue("Because the owner paid for it.");
    const report = await runEvals({
      tutors: [tutor],
      students: [student],
      exchanges: 3,
      tutorChat,
      studentChat,
      judge: async () => judgeReply("pass"),
      models: { tutor: "fake" },
      now: new Date("2026-11-19T12:00:00Z"),
    });
    expect(tutorChat).toHaveBeenCalledTimes(3);
    expect(studentChat).toHaveBeenCalledTimes(3);
    expect(tutorChat.mock.calls[0]?.[0].system).toContain("You are Dr River.");
    expect(tutorChat.mock.calls[1]?.[0].messages.at(-1)).toEqual({
      role: "user",
      content: "Because the owner paid for it.",
    });
    expect(studentChat.mock.calls[0]?.[0].system).toContain(student.behaviourRules[0]);
    expect(studentChat.mock.calls[0]?.[0].messages.at(-1)?.role).toBe("user");
    const [run] = report.runs;
    expect(run?.transcript).toHaveLength(6);
    expect(run?.transcript[0]).toMatchObject({ turn: 1, role: "assistant" });
    expect(run?.verdict?.commitments).toHaveLength(COMMITMENTS.length);
  });

  it("fails the report when the judge fails a commitment, and retries an unusable judge once", async () => {
    const judge = vi
      .fn<ChatFn>()
      .mockResolvedValueOnce("I think it went well!")
      .mockResolvedValue(judgeReply("fail"));
    const report = await runEvals({
      tutors: [tutor],
      students: [student],
      exchanges: 1,
      tutorChat: async () => "What do you mean by own?",
      studentChat: async () => "I mean whoever has the deeds.",
      judge,
      models: {},
    });
    expect(judge).toHaveBeenCalledTimes(2);
    expect(report.passed).toBe(false);
    expect(summariseReport(report)).toContain("needs attention");
  });

  it("records a judge failure without stopping the run", async () => {
    const report = await runEvals({
      tutors: [tutor],
      students: SCRIPTED_STUDENTS.slice(0, 2),
      exchanges: 1,
      tutorChat: async () => "What do you mean by own?",
      studentChat: async () => "Whoever has the deeds.",
      judge: async () => "no json",
      models: {},
    });
    expect(report.runs).toHaveLength(2);
    expect(report.runs.every((run) => run.verdict === null && run.judgeError)).toBe(true);
    expect(summariseReport(report)).toContain("judge failed");
  });

  it("flags a measure that got 5 or more points worse than the previous run", async () => {
    const base = {
      tutors: [tutor],
      students: [student],
      exchanges: 2,
      studentChat: async () => "Whoever has the deeds, because they bought it.",
      judge: async () => judgeReply("pass"),
      models: {},
    };
    const previous = await runEvals({ ...base, tutorChat: async () => "Why?" });
    const current = await runEvals({
      ...base,
      previous,
      tutorChat: async () =>
        "That is interesting. Let me tell you about rights of way, enclosure, common land and the long history of access in England before I ask anything. Why?",
    });
    expect(current.runs[0]?.regressions.map(({ measure }) => measure)).toContain("tutorTalkShare");
    expect(current.passed).toBe(false);
  });
});
