import { describe, expect, it, vi } from "vitest";
import {
  extractQuotes,
  readableCitations,
  renderGroundedFeedback,
  scanQuotes,
  sentenceFailsCheck,
  unverifiedQuotes,
} from "@/lib/feedback/grounded-output";
import {
  canUseGroundedFeedback,
  groundedInput,
  parseModelJson,
  runTesterFeedback,
} from "@/lib/feedback/grounded.server";
import { runGroundedFeedback, type FeedbackDeps } from "@/lib/feedback/pipeline";
import { parseTranscript } from "@/lib/feedback/transcript";
import { countWords } from "@/lib/feedback/word-limit";

const Q1 = "the outer bank erodes faster so the meander migrates downstream";
const Q2 = "a cut-off forms when two bends meet and leaves an oxbow lake";
const Q3 = "flood defences just push the problem further downstream";

const transcriptFor = (tutor: string) =>
  [
    `${tutor}: Why might a river change its course?`,
    `You: I think ${Q1}.`,
    `${tutor}: What stops that continuing?`,
    `You: Well, ${Q2}.`,
    `${tutor}: And people?`,
    `You: I suppose ${Q3}.`,
  ].join("\n\n");
const TRANSCRIPT = transcriptFor("Dr River");
const TURNS = parseTranscript(TRANSCRIPT, "Dr River");

const OBSERVATIONS = [
  {
    id: "a",
    criterionId: "evidence",
    kind: "strength",
    claim: "Migration",
    evidence: [{ turn: 2, quote: Q1 }],
  },
  {
    id: "b",
    criterionId: "thinking-aloud",
    kind: "strength",
    claim: "Cut-offs",
    evidence: [{ turn: 4, quote: Q2 }],
  },
  {
    id: "c",
    criterionId: "scale",
    kind: "improvement",
    claim: "Costs",
    evidence: [{ turn: 6, quote: Q3 }],
  },
];

const WRITER_REPORT = `## Overall impression
You explained two river processes step by step.
## Strengths in reasoning
- You said "${Q1}" [T2].
- You said "${Q2}" [T4].
## Where the reasoning slipped
- You said "${Q3}" [T6] without asking who pays.
## Targeted improvements
- Next time, name one cost of defences when you propose them.
## Try this next
What would change if the river ran through a city?`;

function deps(json: unknown, text: string | (() => Promise<string>)): FeedbackDeps {
  return {
    generateJSON: async () => json,
    generateText: typeof text === "string" ? async () => text : text,
  };
}

async function pipelineResult(writer: string, json: unknown = OBSERVATIONS) {
  return runGroundedFeedback(
    groundedInput({ transcript: TRANSCRIPT, ppe: false }),
    deps(json, writer),
  );
}

describe("extractQuotes", () => {
  it("finds double, curly and single quotations but not apostrophes", () => {
    expect(
      extractQuotes(
        `You said "one two" and “three four” and ‘five six’ and 'seven eight'. Don’t, it's fine.`,
      ),
    ).toEqual(["one two", "three four", "five six", "seven eight"]);
  });

  it("flags words the student did not say, including the tutor's words", () => {
    expect(unverifiedQuotes(`"${Q1}"`, TURNS)).toEqual([]);
    expect(unverifiedQuotes(`“The Outer Bank erodes faster”`, TURNS)).toEqual([]);
    expect(unverifiedQuotes(`"why might a river change its course"`, TURNS)).toHaveLength(1);
    expect(unverifiedQuotes(`"rivers are basically conveyor belts"`, TURNS)).toHaveLength(1);
  });

  it("makes turn citations readable", () => {
    expect(readableCitations("x [T2]. y [T4, T6] z [T1,T2,T3]")).toBe(
      "x (turn 2). y (turns 4 and 6) z (turns 1, 2 and 3)",
    );
  });
});

describe("renderGroundedFeedback", () => {
  it("renders a verified report as the panel's Markdown", async () => {
    const out = renderGroundedFeedback(await pipelineResult(WRITER_REPORT), TURNS);
    expect("text" in out).toBe(true);
    const text = (out as { text: string }).text;
    expect(text).toMatch(/^## Overall impression\n/);
    expect(text).toContain("## Try this next");
    expect(text).toContain(`"${Q1}" (turn 2)`);
    expect(text).not.toMatch(/\[T\d/);
    expect(unverifiedQuotes(text, TURNS)).toEqual([]);
  });

  it("removes a sentence whose quotation was altered, keeping the rest", async () => {
    const altered = WRITER_REPORT.replace(
      `"${Q2}" [T4]`,
      `"a cut-off forms when bends join up" [T4]`,
    );
    const out = renderGroundedFeedback(await pipelineResult(altered), TURNS);
    const text = (out as { text: string }).text;
    expect(text).not.toContain("bends join up");
    expect(text).toContain(Q1);
    expect(unverifiedQuotes(text, TURNS)).toEqual([]);
  });

  it("drops a heading left empty by removed sentences", async () => {
    const altered = WRITER_REPORT.replace(`"${Q3}" [T6]`, `"defences are pointless" [T6]`);
    const text = (renderGroundedFeedback(await pipelineResult(altered), TURNS) as { text: string })
      .text;
    expect(text).not.toContain("Where the reasoning slipped");
    expect(text).toContain("## Targeted improvements");
  });

  it("refuses a report with too few verified quotations left", async () => {
    const altered = WRITER_REPORT.replace(`"${Q1}"`, `"meanders move"`).replace(
      `"${Q2}"`,
      `"oxbows form"`,
    );
    expect(renderGroundedFeedback(await pipelineResult(altered), TURNS)).toEqual({
      failure: "too few verified quotations",
    });
  });

  it("refuses when the analyst failed, the writer failed, or too little was verified", async () => {
    const failing: FeedbackDeps = {
      generateJSON: async () => {
        throw new Error("boom");
      },
      generateText: async () => WRITER_REPORT,
    };
    const input = groundedInput({ transcript: TRANSCRIPT, ppe: false });
    expect(renderGroundedFeedback(await runGroundedFeedback(input, failing), TURNS)).toEqual({
      failure: "analyst failed",
    });
    const noWriter: FeedbackDeps = {
      generateJSON: async () => OBSERVATIONS,
      generateText: async () => {
        throw new Error("boom");
      },
    };
    expect(renderGroundedFeedback(await runGroundedFeedback(input, noWriter), TURNS)).toEqual({
      failure: "writer failed",
    });
    expect(
      renderGroundedFeedback(await pipelineResult(WRITER_REPORT, [OBSERVATIONS[0]]), TURNS),
    ).toEqual({ failure: "too few verified observations" });
  });
});

describe("runTesterFeedback", () => {
  const req = { transcript: TRANSCRIPT, ppe: false, interviewId: "preview" };

  it("returns checked text on success", async () => {
    const out = await runTesterFeedback(req, deps(OBSERVATIONS, WRITER_REPORT));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.text).toContain("(turn 6)");
  });

  it("falls back on a timeout and cancels the model calls", async () => {
    const abort = vi.fn();
    const hanging = deps(OBSERVATIONS, () => new Promise<string>(() => {}));
    const out = await runTesterFeedback(req, hanging, { timeoutMs: 20, abort });
    expect(out).toEqual({ ok: false, reason: "timeout" });
    expect(abort).toHaveBeenCalled();
  });

  it("falls back, never throws, when the analyst returns garbage", async () => {
    for (const junk of [null, "not json", { observations: "x" }, [{ kind: "strength" }]]) {
      const out = await runTesterFeedback(req, deps(junk, WRITER_REPORT));
      expect(out.ok).toBe(false);
    }
  });

  it("keeps the verified feedback under the word limit", async () => {
    const padding = Array.from({ length: 80 }, () => "This sentence adds six more words.").join(
      " ",
    );
    const long = WRITER_REPORT.replace(
      "Next time, name one cost of defences when you propose them.",
      `Next time, name one cost of defences when you propose them. ${padding}`,
    );
    const out = await runTesterFeedback(req, deps(OBSERVATIONS, long));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.truncated).toBe(true);
      expect(countWords(out.text)).toBeLessThanOrEqual(400);
      expect(out.text).not.toContain("## Try this next");
    }
  });

  it("uses Prof Matt's labels, criteria and tester notes for PPE", async () => {
    const input = groundedInput({
      transcript: transcriptFor("Prof Matt"),
      ppe: true,
      cardIds: ["bag-charge"],
    });
    expect(input.tutorName).toBe("Prof Matt");
    expect(input.criteria.map((c) => c.id)).toContain("facts-values");
    expect(input.backendContext).toContain("[bag-charge]");
    const out = await runTesterFeedback(
      { transcript: transcriptFor("Prof Matt"), ppe: true },
      deps(OBSERVATIONS, WRITER_REPORT),
    );
    expect(out.ok).toBe(true);
  });
});

describe("canUseGroundedFeedback", () => {
  it("needs a transcript with two student turns and no video", () => {
    expect(canUseGroundedFeedback({ transcript: TRANSCRIPT, video: "", ppe: false })).toBe(true);
    expect(
      canUseGroundedFeedback({
        transcript: TRANSCRIPT,
        video: "data:video/mp4;base64,AA",
        ppe: false,
      }),
    ).toBe(false);
    expect(
      canUseGroundedFeedback({ transcript: "", video: "data:video/mp4;base64,AA", ppe: false }),
    ).toBe(false);
    expect(canUseGroundedFeedback({ transcript: "x", video: "", ppe: false })).toBe(false);
    expect(
      canUseGroundedFeedback({ transcript: transcriptFor("Prof Matt"), video: "", ppe: true }),
    ).toBe(true);
  });
});

describe("parseModelJson", () => {
  it("reads bare, fenced and wrapped JSON", () => {
    expect(parseModelJson('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseModelJson('```json\n{"observations":[]}\n```')).toEqual({ observations: [] });
    expect(parseModelJson("Here you go: [1, 2] done")).toEqual([1, 2]);
    expect(parseModelJson("nothing here")).toBeNull();
    expect(parseModelJson(undefined)).toBeNull();
  });
});

describe("quotation checking fails closed (verifier findings)", () => {
  /** The tester sees nothing unsaid: either the run falls back, or the words are gone. */
  async function shown(writer: string): Promise<string | null> {
    const out = renderGroundedFeedback(await pipelineResult(writer), TURNS);
    return "text" in out ? out.text : null;
  }
  const strengthLine = `- You said "${Q2}" [T4].`;

  it("reads a double quotation that wraps onto the next line", () => {
    expect(scanQuotes('You argued "rivers gave early towns\n  water and wealth" here.')).toEqual({
      quotes: ["rivers gave early towns\n  water and wealth"],
      unpaired: false,
    });
  });

  it("never shows unsaid words in a quotation wrapped over two lines", async () => {
    const writer = WRITER_REPORT.replace(
      strengthLine,
      `- You argued "the outer bank erodes faster\n  and invented much more wealth" here [T2].`,
    );
    const text = await shown(writer);
    if (text !== null) {
      expect(text).not.toContain("invented much more wealth");
      expect(unverifiedQuotes(text, TURNS)).toEqual([]);
    }
  });

  it("falls back when the feedback contains a blockquote", async () => {
    const writer = WRITER_REPORT.replace(
      strengthLine,
      `${strengthLine}\n> rivers are conveyor belts`,
    );
    expect(renderGroundedFeedback(await pipelineResult(writer), TURNS)).toEqual({
      failure: "blockquote",
    });
  });

  it.each([
    ["guillemets", "«rivers are conveyor belts of sediment»"],
    ["reversed guillemets", "»rivers are conveyor belts of sediment«"],
    ["German low-high marks", "„rivers are conveyor belts of sediment“"],
    ["backticks", "`rivers are conveyor belts of sediment`"],
    ["an unpaired double mark", '"rivers are conveyor belts of sediment'],
    ["an unpaired opening single mark", "‘rivers are conveyor belts of sediment"],
  ])("treats %s as a quotation to check", async (_, quoted) => {
    expect(sentenceFailsCheck(`You said ${quoted} [T2].`, TURNS)).toBe(true);
    const text = await shown(
      WRITER_REPORT.replace(strengthLine, `${strengthLine}\n- You said ${quoted} [T2].`),
    );
    if (text !== null) expect(text).not.toContain("conveyor belts");
  });

  it("accepts the student's own words in any of those marks", () => {
    for (const quoted of [`«${Q1}»`, `„${Q1}“`, `\`${Q1}\``, `‘${Q1}’`, `'${Q1}'`]) {
      expect(sentenceFailsCheck(`You said ${quoted} [T2].`, TURNS)).toBe(false);
    }
    // Apostrophes are not quotation marks.
    expect(sentenceFailsCheck("You don't weigh the students' views or the city’s.", TURNS)).toBe(
      false,
    );
  });

  it("drops a sentence whose quotation is not in the turn it cites", async () => {
    expect(sentenceFailsCheck(`You said ‘${Q1}’ [T4].`, TURNS)).toBe(true);
    expect(sentenceFailsCheck(`You said ‘${Q1}’ [T2].`, TURNS)).toBe(false);
    expect(sentenceFailsCheck(`You said ‘${Q1}’ [T2, T4].`, TURNS)).toBe(false);
    // With no turn cited, any student turn will do.
    expect(sentenceFailsCheck(`You said ‘${Q1}’.`, TURNS)).toBe(false);
    const text = await shown(WRITER_REPORT.replace(`"${Q1}" [T2]`, `"${Q1}" [T4]`));
    expect(text).not.toBeNull();
    expect(text).not.toContain(Q1);
    expect(text).toContain(Q2);
  });
});
