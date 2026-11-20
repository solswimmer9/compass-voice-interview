// Runs scripted-student simulations against a tutor's prompt, scores them with the metrics and
// thresholds, and asks a judge model for verdicts (architecture document section 12).
// The model calls are passed in, so this runs with the real gateway (`cli.ts`) or with fakes in
// tests. Text mode stands in for the voice model: it tests the prompt, not the voice.
import type { Turn } from "@/lib/feedback/types";
import { buildJudgePrompt, EVAL_KIT_VERSION, judgeVerdictSchema, type JudgeVerdict } from "./judge";
import {
  checkThresholds,
  compareRuns,
  groupTurns,
  interviewMetrics,
  type InterviewMetrics,
  type RunComparison,
  type ThresholdReport,
  type TranscriptDelta,
} from "./metrics";
import type { ScriptedStudent } from "./scripted-students";

export type ChatMessage = { role: "user" | "assistant"; content: string };
/** One text-model call: a system prompt and the conversation so far; returns the reply. */
export type ChatFn = (args: { system: string; messages: ChatMessage[] }) => Promise<string>;

export type TutorUnderTest = {
  id: string;
  /** The live instructions students get. */
  instructions: string;
  /** The greeting instruction sent when the call opens. */
  opening: string;
  /** Versions, recorded with each run so results can be compared. */
  versions: Record<string, string>;
};

export type StudentRun = {
  tutorId: string;
  studentId: string;
  transcript: Turn[];
  metrics: InterviewMetrics;
  thresholds: ThresholdReport;
  verdict: JudgeVerdict | null;
  judgeError?: string;
  /** Measures 5+ points worse than the previous run of the same tutor and student. */
  regressions: RunComparison[];
};

export type EvalReport = {
  evalKitVersion: string;
  createdAt: string;
  models: Record<string, string>;
  tutors: { id: string; versions: Record<string, string> }[];
  runs: StudentRun[];
  passed: boolean;
};

const TEXT_MODE_NOTE =
  "This is a text rehearsal of the spoken interview. Reply with exactly what you would say aloud, and nothing else: no stage directions, no headings.";

function studentSystem(student: ScriptedStudent) {
  return [
    "You are role-playing a Year 13 student in a practice admissions interview. Stay in character and reply with exactly what the student says aloud, one to four sentences, with no stage directions.",
    "Use only everyday knowledge a bright 17-year-old might have; the tutor supplies any subject material.",
    `This student: ${student.description}`,
    "Behave like this:",
    ...student.behaviourRules.map((rule) => `- ${rule}`),
  ].join("\n");
}

/** Synthetic timings: about 0.4 seconds per word, with a short gap between speakers. */
function timed(turns: { role: "user" | "assistant"; text: string }[]): TranscriptDelta[] {
  let clock = 0;
  return turns.map(({ role, text }) => {
    const words = text.split(/\s+/u).filter(Boolean).length;
    const start = clock + 800;
    const end = start + Math.max(1, words) * 400;
    clock = end;
    return { role, text, start_ms: start, end_ms: end };
  });
}

/** Tutor and simulated student take turns, starting from the tutor's opening. */
export async function simulateInterview(input: {
  tutor: TutorUnderTest;
  student: ScriptedStudent;
  exchanges: number;
  tutorChat: ChatFn;
  studentChat: ChatFn;
}): Promise<{ role: "user" | "assistant"; text: string }[]> {
  const tutorSystem = `${input.tutor.instructions}\n\n${TEXT_MODE_NOTE}`;
  const said: { role: "user" | "assistant"; text: string }[] = [];
  // From the tutor's side the student is "user"; from the student's side it is the reverse.
  const forTutor = (): ChatMessage[] => [
    { role: "user", content: `(The student has joined the call.) ${input.tutor.opening}` },
    ...said.map(({ role, text }) => ({ role, content: text })),
  ];
  const forStudent = (): ChatMessage[] =>
    said.map(({ role, text }) => ({
      role: role === "assistant" ? ("user" as const) : ("assistant" as const),
      content: text,
    }));
  for (let index = 0; index < input.exchanges; index++) {
    const tutorLine = (await input.tutorChat({ system: tutorSystem, messages: forTutor() })).trim();
    said.push({ role: "assistant", text: tutorLine || "(silence)" });
    const studentLine = (
      await input.studentChat({ system: studentSystem(input.student), messages: forStudent() })
    ).trim();
    said.push({ role: "user", text: studentLine || "(silence)" });
  }
  return said;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the judge's reply");
  return JSON.parse(text.slice(start, end + 1));
}

/** Asks the judge for verdicts, retrying once on an unusable reply. */
export async function judgeTranscript(
  judge: ChatFn,
  student: ScriptedStudent,
  transcript: Turn[],
): Promise<JudgeVerdict> {
  const prompt = buildJudgePrompt({ transcriptTurns: transcript, student });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await judge({
        system: "You audit interviews and reply with JSON only.",
        messages: [{ role: "user", content: prompt }],
      });
      return judgeVerdictSchema.parse(extractJson(reply));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("judge failed");
}

export async function runEvals(input: {
  tutors: TutorUnderTest[];
  students: readonly ScriptedStudent[];
  exchanges: number;
  tutorChat: ChatFn;
  studentChat: ChatFn;
  judge: ChatFn;
  models: Record<string, string>;
  /** The previous report, if any, to flag regressions against. */
  previous?: EvalReport | undefined;
  now?: Date;
  onProgress?: (message: string) => void;
}): Promise<EvalReport> {
  const runs: StudentRun[] = [];
  for (const tutor of input.tutors) {
    for (const student of input.students) {
      input.onProgress?.(`${tutor.id} × ${student.id}`);
      const said = await simulateInterview({
        tutor,
        student,
        exchanges: input.exchanges,
        tutorChat: input.tutorChat,
        studentChat: input.studentChat,
      });
      const turns = groupTurns(timed(said));
      const transcript = turns.map(({ turn, role, text }) => ({ turn, role, text }));
      const metrics = interviewMetrics(turns);
      let verdict: JudgeVerdict | null = null;
      let judgeError: string | undefined;
      try {
        verdict = await judgeTranscript(input.judge, student, transcript);
      } catch (error) {
        judgeError = error instanceof Error ? error.message : String(error);
      }
      const before = input.previous?.runs.find(
        (run) => run.tutorId === tutor.id && run.studentId === student.id,
      );
      runs.push({
        tutorId: tutor.id,
        studentId: student.id,
        transcript,
        metrics,
        thresholds: checkThresholds(metrics),
        verdict,
        ...(judgeError ? { judgeError } : {}),
        regressions: before ? compareRuns(before.metrics, metrics) : [],
      });
    }
  }
  const passed = runs.every(
    (run) =>
      run.thresholds.passed &&
      run.regressions.length === 0 &&
      !run.verdict?.commitments.some(({ verdict }) => verdict === "fail"),
  );
  return {
    evalKitVersion: EVAL_KIT_VERSION,
    createdAt: (input.now ?? new Date()).toISOString(),
    models: input.models,
    tutors: input.tutors.map(({ id, versions }) => ({ id, versions })),
    runs,
    passed,
  };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** A short, readable summary of a report, for the terminal or a pull request. */
export function summariseReport(report: EvalReport): string {
  const lines = [
    `# Interview evals (${report.createdAt.slice(0, 10)})`,
    "",
    `Overall: **${report.passed ? "passed" : "needs attention"}**. Kit ${report.evalKitVersion}; models ${Object.entries(
      report.models,
    )
      .map(([role, model]) => `${role} ${model}`)
      .join(", ")}.`,
    "",
    "| Tutor | Student | Tutor talk | Long turns | Leading | Refers back | Judge fails | Regressions |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const run of report.runs) {
    const fails = run.verdict
      ? run.verdict.commitments.filter(({ verdict }) => verdict === "fail").map(({ id }) => id)
      : null;
    lines.push(
      [
        run.tutorId,
        run.studentId,
        percent(run.metrics.tutorTalkShare),
        percent(run.metrics.longTutorTurnShare),
        percent(run.metrics.leadingShare),
        percent(run.metrics.referenceShare),
        fails === null ? `judge failed` : fails.length ? fails.join(", ") : "none",
        run.regressions.length ? run.regressions.map(({ measure }) => measure).join(", ") : "none",
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .concat(" |"),
    );
  }
  const failedThresholds = report.runs.flatMap((run) =>
    run.thresholds.results
      .filter(({ pass }) => pass === false)
      .map(({ measure }) => `${run.tutorId} × ${run.studentId}: ${measure}`),
  );
  if (failedThresholds.length) {
    lines.push("", "Thresholds missed:", ...failedThresholds.map((line) => `- ${line}`));
  }
  return lines.join("\n");
}
