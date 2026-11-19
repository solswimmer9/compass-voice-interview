// The evidence-checked feedback path in handleAssess: every account, with silent fallback to the
// single-call feedback, and the word limit on both paths. Model calls are mocked; no real gateway.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countWords } from "@/lib/feedback/word-limit";
import { ARGUMENT_MAP_ONLY_SYSTEM } from "@/lib/feedback/argument-map.server";
import { parseArgumentMap, splitFeedbackStream } from "@/lib/feedback/argument-map";

const authenticateRequest = vi.fn();
const streamText = vi.fn();
const generateText = vi.fn();

vi.mock("@/lib/request-auth.server", () => ({ authenticateRequest }));
vi.mock("../lib/request-auth.server.ts", () => ({ authenticateRequest }));
vi.mock("ai", () => ({ streamText, generateText }));

const URL = "https://compass-voice-interview.lovable.app/api/assess";
const INTERVIEW = "00000000-0000-0000-0000-000000000000";

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

const OBSERVATIONS = JSON.stringify([
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
]);
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

const TODAY_TEXT = "## Overall impression\nToday's single-call feedback.";

function streamOf(
  ...chunks: ({ type: "text-delta"; text: string } | { type: "error"; error: unknown })[]
) {
  return {
    fullStream: (async function* () {
      for (const c of chunks) yield c;
    })(),
  };
}

let visitor = 0;
let student = 0;
function post(body: unknown, signal?: AbortSignal) {
  return new Request(URL, {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: {
      "content-type": "application/json",
      authorization: "Bearer a.b.c",
      // A fresh visitor each time, so the in-memory feedback rate limit never interferes.
      "x-forwarded-for": `198.51.100.${++visitor % 250}`,
    },
    body: JSON.stringify(body),
  });
}

function signIn(email: string, consumed = true) {
  const rpc = vi.fn().mockResolvedValue({ data: consumed, error: null });
  // A fresh student id each time too, so the per-student feedback limit never interferes.
  authenticateRequest.mockResolvedValue({
    user: { id: `student-${++student}`, email },
    supabase: { rpc },
  });
  return rpc;
}

const MAP_REPLY = `<<<ARGUMENT_MAP>>>
{"claim":"meanders migrate downstream","challenges":[{"text":"What stops that continuing?","responses":[{"text":"cut-offs form oxbow lakes","status":"held"}]}]}`;

/** True for the separate argument-map call, which runs alongside the analyst and writer. */
const isMapCall = (args: { system?: string }) => args.system === ARGUMENT_MAP_ONLY_SYSTEM;

/**
 * Analyst reply first, then writer replies. The argument-map call runs in parallel, so it is
 * answered by its prompt rather than by call order.
 */
function modelReplies(analyst: string, ...writer: string[]) {
  const queue = [analyst, ...writer];
  generateText.mockImplementation(async (args: { system?: string }) => {
    if (isMapCall(args)) return { text: MAP_REPLY };
    const next = queue.shift();
    if (next === undefined) throw new Error("no more replies");
    return { text: next };
  });
}

/** The analyst and writer calls only (not the argument-map call). */
const pipelineCalls = () =>
  (generateText.mock.calls as [{ system?: string; prompt: string }][]).filter(
    ([args]) => !isMapCall(args),
  );

const QUOTE = /"([^"\n]+)"/g;

describe("tester feedback goes through the evidence-checked pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
    authenticateRequest.mockReset();
    streamText.mockReset();
    generateText.mockReset();
    streamText.mockImplementation(() => streamOf({ type: "text-delta", text: TODAY_TEXT }));
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("shows a tester only quotations found in their own turns", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = signIn("tester@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT);
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: "preview" }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/^## Overall impression/);
    expect(text).toContain("(turn 4)");
    expect(text).not.toContain("[[error]]");
    const studentWords = [Q1, Q2, Q3].join(" | ");
    const { letter } = splitFeedbackStream(text);
    const quotes = [...letter.matchAll(QUOTE)].map((m) => m[1]!);
    expect(quotes.length).toBeGreaterThanOrEqual(2);
    for (const q of quotes) expect(studentWords).toContain(q);
    expect(streamText).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    // Three calls (analyst, writer, argument map), all on the gateway text model with the
    // server-side key.
    expect(pipelineCalls()).toHaveLength(2);
    expect(generateText).toHaveBeenCalledTimes(3);
    for (const [args] of generateText.mock.calls as [
      { model: { modelId: string }; abortSignal: AbortSignal; prompt: string },
    ][]) {
      expect(args.model.modelId).toBe("openai/gpt-6-astra");
      expect(args.abortSignal).toBeInstanceOf(AbortSignal);
      expect(args.prompt).not.toContain("test-key");
    }
  });

  it("removes an altered quotation before the tester sees it", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("tester@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT.replace(`"${Q2}"`, `"bends meet and make lakes"`));
    const text = await (
      await handleAssess(post({ transcript: TRANSCRIPT, interviewId: "preview" }))
    ).text();
    expect(text).not.toContain("make lakes");
    expect(text).toContain(Q1);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("gives a tester PPE feedback from Prof Matt's criteria and notes", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("tester@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT);
    const response = await handleAssess(
      post({
        transcript: transcriptFor("Prof Matt"),
        interviewId: "preview",
        tutorId: "ppe",
        cardIds: ["bag-charge"],
      }),
    );
    expect(await response.text()).toContain("(turn 6)");
    const analyst = pipelineCalls()[0]![0].prompt;
    expect(analyst).toContain("facts-values");
    expect(analyst).toContain("[bag-charge]");
  });

  it.each([
    [
      "the analyst returns nothing usable",
      () => modelReplies("I cannot help with that.", WRITER_REPORT),
    ],
    ["a model call throws", () => generateText.mockRejectedValue(new Error("gateway down"))],
    [
      "every quotation fails the check",
      () =>
        modelReplies(
          OBSERVATIONS,
          WRITER_REPORT.replace(`"${Q1}"`, `"x y z w"`).replace(`"${Q2}"`, `"p q r s"`),
        ),
    ],
  ])("falls back silently to today's feedback when %s", async (_, arrange) => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = signIn("tester@example.com");
    arrange();
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: "preview" }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(TODAY_TEXT);
    expect(streamText).toHaveBeenCalledTimes(1);
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("Cambridge geography admissions tutor");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falls back to today's feedback when the pipeline times out", async () => {
    vi.useFakeTimers();
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("tester@example.com");
    let signal: AbortSignal | undefined;
    generateText.mockImplementation((args: { abortSignal: AbortSignal; system?: string }) => {
      if (!isMapCall(args)) signal = args.abortSignal;
      return new Promise(() => {});
    });
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: "preview" }));
    const textPromise = response.text();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await textPromise).toBe(TODAY_TEXT);
    expect(signal?.aborted).toBe(true);
  });

  it("uses today's feedback for a tester's video submission", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("tester@example.com");
    for (const transcript of ["", TRANSCRIPT]) {
      const response = await handleAssess(
        post({
          transcript,
          video: "data:video/mp4;base64,AAAA",
          videoType: "video/mp4",
          interviewId: "preview",
        }),
      );
      expect(await response.text()).toBe(TODAY_TEXT);
    }
    expect(generateText).not.toHaveBeenCalled();
    expect(streamText).toHaveBeenCalledTimes(2);
  });
});

describe("student feedback is evidence-checked, with the single-call path as fallback", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
    authenticateRequest.mockReset();
    streamText.mockReset();
    generateText.mockReset();
    streamText.mockImplementation(() => streamOf({ type: "text-delta", text: TODAY_TEXT }));
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** One student turn: too short to quote from, so it always takes the single-call path. */
  const SHORT = ["Dr River: Why might a river change its course?", `You: I think ${Q1}.`].join(
    "\n\n",
  );

  it("gives a student checked feedback with only their own words quoted, charged once", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = signIn("student@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT);
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }));
    expect(response.status).toBe(200);
    const text = await response.text();
    const { letter, mapSource, error } = splitFeedbackStream(text);
    expect(error).toBeNull();
    expect(letter).toMatch(/^## Overall impression/);
    expect(letter).toContain("(turn 4)");
    const studentWords = [Q1, Q2, Q3].join(" | ");
    const quotes = [...letter.matchAll(QUOTE)].map((m) => m[1]!);
    expect(quotes.length).toBeGreaterThanOrEqual(2);
    for (const q of quotes) expect(studentWords).toContain(q);
    expect(countWords(letter)).toBeLessThanOrEqual(400);
    // The argument map still reaches the panel, in the form it already reads.
    expect(parseArgumentMap(mapSource)?.claim).toBe("meanders migrate downstream");
    expect(streamText).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("consume_feedback", { p_interview_id: INTERVIEW });
    for (const [args] of generateText.mock.calls as [{ model: { modelId: string } }][])
      expect(args.model.modelId).toBe("openai/gpt-6-astra");
  });

  it("never gives a student's analyst draft PPE notes", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT);
    await (
      await handleAssess(
        post({
          transcript: transcriptFor("Prof Matt"),
          interviewId: INTERVIEW,
          tutorId: "ppe",
          cardIds: ["bag-charge", "fairness-three-principles"],
        }),
      )
    ).text();
    const analyst = pipelineCalls()[0]![0].prompt;
    expect(analyst).toContain("facts-values");
    expect(analyst).not.toContain("[bag-charge]");
    expect(analyst).toContain("[fairness-three-principles]");
  });

  it("still shows the checked letter when the argument map is unusable", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const queue = [OBSERVATIONS, WRITER_REPORT];
    generateText.mockImplementation(async (args: { system?: string }) =>
      isMapCall(args) ? { text: "Sorry, no map." } : { text: queue.shift() },
    );
    const text = await (
      await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }))
    ).text();
    expect(text).toMatch(/^## Overall impression/);
    expect(text).toContain("(turn 4)");
    expect(text).not.toContain("<<<ARGUMENT_MAP>>>");
    expect(streamText).not.toHaveBeenCalled();
  });

  it("gives the student's analyst the chart notes in an object interview", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    modelReplies(OBSERVATIONS, WRITER_REPORT);
    await (
      await handleAssess(
        post({ transcript: TRANSCRIPT, interviewId: INTERVIEW, objectId: "geo-chart-a" }),
      )
    ).text();
    expect(pipelineCalls()[0]![0].prompt).toContain("OBJECT INTERVIEW NOTES");
  });

  it("sends the checked letter without waiting long for a slow map, then cancels the map call", async () => {
    vi.useFakeTimers();
    const { handleAssess, MAP_GRACE_MS } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const queue = [OBSERVATIONS, WRITER_REPORT];
    let mapSignal: AbortSignal | undefined;
    generateText.mockImplementation(async (args: { system?: string; abortSignal: AbortSignal }) => {
      if (isMapCall(args)) {
        mapSignal = args.abortSignal;
        return new Promise(() => {});
      }
      return { text: queue.shift() };
    });
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }));
    const reader = response.body!.getReader();
    const first = await reader.read();
    const letter = new TextDecoder().decode(first.value);
    expect(letter).toMatch(/^## Overall impression/);
    expect(letter).toContain("(turn 4)");
    expect(mapSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(MAP_GRACE_MS);
    expect((await reader.read()).done).toBe(true);
    expect(mapSignal?.aborted).toBe(true);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("cancels the map call when the checked path falls back", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    let mapSignal: AbortSignal | undefined;
    generateText.mockImplementation(async (args: { system?: string; abortSignal: AbortSignal }) => {
      if (isMapCall(args)) {
        mapSignal = args.abortSignal;
        return new Promise(() => {});
      }
      return { text: "I cannot help with that." };
    });
    const text = await (
      await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }))
    ).text();
    expect(text).toBe(TODAY_TEXT);
    expect(mapSignal?.aborted).toBe(true);
  });

  it("stops everything, with no fallback call, when the student leaves mid-check", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const leave = new AbortController();
    const signals: AbortSignal[] = [];
    generateText.mockImplementation(
      (args: { abortSignal: AbortSignal }) =>
        new Promise((_, reject) => {
          signals.push(args.abortSignal);
          args.abortSignal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const response = await handleAssess(
      post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }, leave.signal),
    );
    const reader = response.body!.getReader();
    const done = reader.read().catch(() => ({ done: true, value: undefined }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    leave.abort();
    await done;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) expect(signal.aborted).toBe(true);
    expect(streamText).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the analyst returns nothing usable",
      () => modelReplies("I cannot help with that.", WRITER_REPORT),
    ],
    ["a model call throws", () => generateText.mockRejectedValue(new Error("gateway down"))],
  ])(
    "falls back silently to single-call feedback for a student when %s, charging once",
    async (_, arrange) => {
      const { handleAssess } = await import("@/lib/assess.server");
      const rpc = signIn("student@example.com");
      arrange();
      const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(TODAY_TEXT);
      expect(streamText).toHaveBeenCalledTimes(1);
      const args = streamText.mock.calls[0]![0] as {
        system: string;
        messages: { content: string }[];
        providerOptions: { openai: { reasoningEffort: string } };
      };
      expect(args.system).toContain("Cambridge geography admissions tutor");
      expect(args.messages[0]!.content).toBe(`Interview transcript:\n\n${TRANSCRIPT}`);
      expect(args.providerOptions.openai.reasoningEffort).toBe("medium");
      expect(rpc).toHaveBeenCalledTimes(1);
    },
  );

  it("falls back for a student when the pipeline times out, and cancels the model calls", async () => {
    vi.useFakeTimers();
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const signals: AbortSignal[] = [];
    generateText.mockImplementation((args: { abortSignal: AbortSignal }) => {
      signals.push(args.abortSignal);
      return new Promise(() => {});
    });
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }));
    const textPromise = response.text();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await textPromise).toBe(TODAY_TEXT);
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) expect(signal.aborted).toBe(true);
  });

  it("uses single-call feedback for a student's video or a very short transcript", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    for (const body of [
      { transcript: "", video: "data:video/mp4;base64,AAAA", videoType: "video/mp4" },
      { transcript: SHORT },
    ]) {
      const response = await handleAssess(post({ ...body, interviewId: INTERVIEW }));
      expect(await response.text()).toBe(TODAY_TEXT);
    }
    expect(generateText).not.toHaveBeenCalled();
    expect(streamText).toHaveBeenCalledTimes(2);
  });

  it("makes no model call at all once the interview's feedback is used", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com", false);
    const response = await handleAssess(post({ transcript: TRANSCRIPT, interviewId: INTERVIEW }));
    expect(response.status).toBe(403);
    expect(generateText).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("passes a single-call reply within the limit through unchanged, in its original pieces", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const pieces = [
      "## Overall imp",
      "ression\nYou reasoned. ",
      "Then you",
      " stopped.\n\n## Try this next\nWhy?",
    ];
    streamText.mockReturnValue(
      streamOf(...pieces.map((text) => ({ type: "text-delta" as const, text }))),
    );
    const response = await handleAssess(post({ transcript: SHORT, interviewId: INTERVIEW }));
    expect(await response.text()).toBe(pieces.join(""));
  });

  it("shortens a single-call reply over 400 words at a sentence boundary", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    const para = Array.from({ length: 50 }, (_, i) => `Point ${i} is made in seven words.`).join(
      " ",
    );
    const reply = `## Overall impression\n${para}\n\n## Try this next\n${para}`;
    streamText.mockReturnValue(
      streamOf(
        ...reply.match(/[\s\S]{1,13}/g)!.map((text) => ({ type: "text-delta" as const, text })),
      ),
    );
    const text = await (
      await handleAssess(post({ transcript: SHORT, interviewId: INTERVIEW }))
    ).text();
    expect(countWords(text)).toBeLessThanOrEqual(400);
    expect(text.endsWith("seven words.")).toBe(true);
    expect(reply.startsWith(text)).toBe(true);
  });

  it("still reports a single-call model error after the text sent so far", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn("student@example.com");
    streamText.mockReturnValue(
      streamOf(
        { type: "text-delta", text: "## Overall impression\nHalf a" },
        { type: "error", error: { statusCode: 429 } },
      ),
    );
    const text = await (
      await handleAssess(post({ transcript: SHORT, interviewId: INTERVIEW }))
    ).text();
    expect(text).toBe(
      "## Overall impression\nHalf a\n\n[[error]]Too many requests right now. Please try again in a minute.",
    );
  });
});
