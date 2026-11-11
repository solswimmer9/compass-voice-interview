import { describe, expect, it } from "vitest";
import {
  FEEDBACK_PIPELINE_VERSION,
  buildAnalystPrompt,
  buildWriterPrompt,
  citedTurns,
  observationSchema,
  parseObservations,
  runGroundedFeedback,
  type FeedbackDeps,
  type FeedbackInput,
} from "@/lib/feedback/pipeline";

const Q1 = "the outer bank erodes faster so the meander migrates downstream";
const Q2 = "a cut-off forms when two bends meet and leaves an oxbow lake";
const Q3 = "flood defences just push the problem further downstream";
const SECRET = "my private hobby is collecting unusual stamps from Peru";

const transcript = [
  "Dr River: Why might a river change its course?",
  `You: I think ${Q1}.`,
  "Dr River: What stops that continuing?",
  `You: Well, ${Q2}.`,
  "Dr River: And people?",
  `You: I suppose ${Q3}.`,
  "Dr River: Anything else?",
  `You: ${SECRET}.`,
].join("\n\n");

const input: FeedbackInput = {
  transcript,
  tutorName: "Dr River",
  criteria: [
    { id: "c1", name: "Process", evidenceLooksLike: "explains how", notEvidence: "naming terms" },
  ],
  reasoningGuide: "GUIDE: judge reasoning, not knowledge.",
};

const goodObs = [
  {
    id: "a",
    criterionId: "c1",
    kind: "strength",
    claim: "Explained meander migration",
    evidence: [{ turn: 2, quote: Q1 }],
  },
  {
    id: "b",
    criterionId: "c1",
    kind: "strength",
    claim: "Explained cut-offs",
    evidence: [{ turn: 4, quote: Q2 }],
  },
  {
    id: "c",
    criterionId: "c1",
    kind: "improvement",
    claim: "Did not weigh costs of defences",
    evidence: [{ turn: 6, quote: Q3 }],
  },
];

const goodReport = `## Overall impression
You explained two processes clearly.
## Strengths in reasoning
- You said "${Q1}" [T2].
- You said "${Q2}" [T4].
## Where the reasoning slipped
- You said "${Q3}" [T6] without weighing costs.
## Targeted improvements
- Next time, name one cost of defences when you propose them.
## Try this next
What would change if the river were much larger?`;

function fakeDeps(
  json: unknown,
  texts: string[],
): FeedbackDeps & { prompts: string[]; calls: { text: number } } {
  const prompts: string[] = [];
  const calls = { text: 0 };
  return {
    prompts,
    calls,
    generateJSON: async () => json,
    generateText: async ({ prompt }) => {
      prompts.push(prompt);
      return texts[Math.min(calls.text++, texts.length - 1)]!;
    },
  };
}

describe("runGroundedFeedback", () => {
  it("happy path produces sections, stats and version", async () => {
    const deps = fakeDeps(goodObs, [goodReport]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(stats).toEqual({
      proposed: 3,
      verified: 3,
      dropped: 0,
      slopRetries: 0,
      removedSentences: 0,
    });
    expect(report.sections.map((s) => s.heading)).toEqual([
      "Overall impression",
      "Strengths in reasoning",
      "Where the reasoning slipped",
      "Targeted improvements",
      "Try this next",
    ]);
    expect(report.sections[1]!.observationIds).toEqual(["a", "b"]);
    expect(report.nextQuestion).toContain("river were much larger");
    expect(report.observations).toHaveLength(3);
    expect(report.manifest).toEqual({ pipelineVersion: FEEDBACK_PIPELINE_VERSION });
    expect(deps.calls.text).toBe(1);
  });

  it("drops an invented quote and never shows it to the writer", async () => {
    const invented = {
      id: "x",
      criterionId: "c1",
      kind: "strength",
      claim: "Cited tidal bores",
      evidence: [{ turn: 2, quote: "tidal bores reverse the flow of estuaries daily" }],
    };
    const deps = fakeDeps([...goodObs, invented], [goodReport]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(stats.proposed).toBe(4);
    expect(stats.verified).toBe(3);
    expect(stats.dropped).toBe(1);
    expect(report.observations.map((o) => o.id)).not.toContain("x");
    expect(deps.prompts[0]).not.toContain("tidal bores");
    expect(deps.prompts[0]).not.toContain("Cited tidal bores");
  });

  it("survives garbage from the analyst", async () => {
    for (const junk of ["not json", null, 42, { foo: 1 }, [1, "a", null, { kind: "strength" }]]) {
      const deps = fakeDeps(junk, [goodReport]);
      const { report } = await runGroundedFeedback(input, deps);
      expect(report.sections[0]!.body).toMatch(/too short or too unclear/);
      expect(deps.calls.text).toBe(0);
    }
    const throwing: FeedbackDeps = {
      generateJSON: async () => {
        throw new Error("boom");
      },
      generateText: async () => "x",
    };
    const { report } = await runGroundedFeedback(input, throwing);
    expect(report.caveats.join(" ")).toMatch(/failed/);
  });

  it("keeps good items and discards malformed ones", () => {
    const { observations, proposed } = parseObservations({
      observations: [goodObs[0], { kind: "nonsense" }, "str", goodObs[1]],
    });
    expect(proposed).toBe(4);
    expect(observations.map((o) => o.id)).toEqual(["a", "b"]);
    expect(observationSchema.safeParse({}).success).toBe(false);
  });

  it("says plainly when too thin, without calling the writer", async () => {
    const deps = fakeDeps([goodObs[0]], [goodReport]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(stats.verified).toBe(1);
    expect(deps.calls.text).toBe(0);
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0]!.body).toMatch(/too short or too unclear/);
  });

  it("retries once when the writer produces slop, and uses the clean retry", async () => {
    const sloppy = `${goodReport}\nGreat job overall.`;
    const deps = fakeDeps(goodObs, [sloppy, goodReport]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(stats.slopRetries).toBe(1);
    expect(stats.removedSentences).toBe(0);
    expect(deps.prompts[1]).toContain('"Great job"');
    expect(JSON.stringify(report.sections)).not.toMatch(/great job/i);
  });

  it("strips slop sentences and records a caveat if the retry is still sloppy", async () => {
    const sloppy = goodReport.replace(
      "You explained two processes clearly.",
      "You explained two processes clearly. Great job on this.",
    );
    const deps = fakeDeps(goodObs, [sloppy]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(deps.calls.text).toBe(2);
    expect(stats.slopRetries).toBe(1);
    expect(stats.removedSentences).toBe(1);
    expect(report.sections[0]!.body).toBe("You explained two processes clearly.");
    expect(report.caveats.join(" ")).toMatch(/removed/);
  });

  it("removes sentences citing a turn with no verified observation", async () => {
    const bad = goodReport.replace(
      "## Targeted improvements",
      `- You also said "something I made up entirely" [T8].\n## Targeted improvements`,
    );
    const deps = fakeDeps(goodObs, [bad]);
    const { report, stats } = await runGroundedFeedback(input, deps);
    expect(stats.removedSentences).toBe(1);
    expect(JSON.stringify(report.sections)).not.toContain("[T8]");
    expect(JSON.stringify(report.sections)).toContain("[T6]");
    expect(citedTurns("see [T7, T9] and [note]")).toEqual([7, 9]);
  });

  it("keeps raw transcript text out of the writer prompt unless it is a verified quote", async () => {
    const deps = fakeDeps(goodObs, [goodReport]);
    await runGroundedFeedback(input, deps);
    const w = deps.prompts[0]!;
    expect(w).toContain(Q1);
    expect(w).not.toContain("collecting unusual stamps");
    expect(w).not.toContain("Why might a river change its course");
    expect(w).not.toContain("What stops that continuing");
    expect(w).not.toContain("[T8]");
  });

  it("presents knowledge gaps as reading, not as reasoning flaws", async () => {
    const gap = {
      id: "g",
      criterionId: "c1",
      kind: "knowledge_gap",
      claim: "Did not know what a levee is",
      evidence: [{ turn: 6, quote: Q3 }],
    };
    const deps = fakeDeps([goodObs[0], goodObs[1], gap], [goodReport]);
    await runGroundedFeedback(input, deps);
    const w = deps.prompts[0]!;
    const gapBlock = w.slice(w.indexOf("KNOWLEDGE GAPS"));
    expect(gapBlock).toContain("levee");
    const improvements = w.slice(w.indexOf("IMPROVEMENTS"), w.indexOf("KNOWLEDGE GAPS"));
    expect(improvements).not.toContain("levee");
    expect(w).toMatch(/Worth reading up on/);
    expect(w).toMatch(/Never describe these as slips in reasoning/);
  });

  it("flags unclear turns and keeps them out of improvements", async () => {
    const obs = goodObs.map((o) => (o.id === "c" ? { ...o } : o));
    const deps = fakeDeps(obs, [goodReport]);
    const { report, stats } = await runGroundedFeedback({ ...input, unclearTurns: [6] }, deps);
    expect(stats.verified).toBe(2);
    expect(report.caveats.join(" ")).toMatch(/Turn 6 was unclear/);
  });
});

describe("prompt builders", () => {
  it("analyst prompt numbers turns and lists criteria", () => {
    const p = buildAnalystPrompt(input, [
      { turn: 1, role: "assistant", text: "Hello" },
      { turn: 2, role: "user", text: "Hi there", unclear: true },
    ]);
    expect(p).toContain("[T1] Tutor: Hello");
    expect(p).toContain("[T2] You [speech recognition unclear]: Hi there");
    expect(p).toContain("id: c1");
  });
});
