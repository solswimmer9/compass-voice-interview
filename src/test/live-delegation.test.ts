import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKEND_HISTORY_TURNS,
  DELEGATION_FALLBACK,
  STUDENT_PAUSE_MS,
  backendTranscript,
  bindLiveConnection,
  isListeningSound,
  type LiveSocket,
} from "@/lib/live-relay.server";
import { READINGS } from "@/lib/readings";

type Call = {
  messages: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  succeed(text: string): void;
  fail(): void;
};

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  streamText: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/request-auth.server", () => ({ authenticateAccessToken: mocks.authenticate }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: mocks.streamText,
  generateText: mocks.generateText,
}));

const config = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  key: "server-key",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

let calls: Call[] = [];

// A controllable stand-in for one backend call, shaped like the AI SDK's stream result.
function fakeStream(options: { messages: Call["messages"]; abortSignal: AbortSignal }) {
  let settle!: (result: { text: string; ok: boolean }) => void;
  let abort!: (reason: unknown) => void;
  const done = new Promise<{ text: string; ok: boolean }>((resolve, reject) => {
    settle = resolve;
    abort = reject;
  });
  done.catch(() => undefined);
  options.abortSignal.addEventListener("abort", () => abort(new Error("aborted")));
  calls.push({
    messages: structuredClone(options.messages),
    signal: options.abortSignal,
    succeed: (text) => settle({ text, ok: true }),
    fail: () => settle({ text: "", ok: false }),
  });
  const text = done.then((result) => result.text);
  text.catch(() => undefined);
  return {
    text,
    fullStream: (async function* () {
      const result = await done;
      yield { type: "start-step" };
      if (result.ok) yield { type: "raw", rawValue: { type: "response.completed" } };
      else yield { type: "raw", rawValue: { type: "response.failed" } };
      yield { type: "finish-step" };
      yield { type: "finish", finishReason: result.ok ? "stop" : "error" };
    })(),
  };
}

function socket() {
  let handler: ((data: unknown) => void) | undefined;
  const sent: Array<Record<string, any>> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const live: LiveSocket = {
    readyState: 1,
    send: (data) => void sent.push(JSON.parse(data)),
    close: vi.fn(),
    onMessage: (h) => void (handler = h),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  return { live, sent, receive: (event: object) => handler?.(JSON.stringify(event)) };
}

async function startInterview(extra: Record<string, unknown> = {}) {
  const browser = socket();
  const gateway = socket();
  const connect = vi.fn().mockResolvedValue(gateway.live);
  bindLiveConnection(browser.live, config, { waitUntil: () => undefined }, connect);
  browser.receive({
    type: "app.start",
    sdp: "test-offer",
    openingTurn: 1,
    accessToken: "valid-access-token",
    environment: "live",
    ...extra,
  });
  // Start-up can load content modules for real, so wait for the session rather than a tick count.
  await vi.waitFor(
    async () => {
      await vi.advanceTimersByTimeAsync(0);
      expect(gateway.sent.length).toBeGreaterThan(0);
    },
    { timeout: 5_000, interval: 5 },
  );
  gateway.receive({ type: "gateway.session.created", session: { id: "session-1" } });
  const commentary = () => gateway.sent.filter(({ type }) => type === "session.commentary.append");
  return {
    gateway,
    commentary,
    say: (text: string, role: "user" | "assistant" = "user") =>
      gateway.receive({
        type: `session.${role === "user" ? "input" : "output"}_transcript.delta`,
        delta: text,
      }),
    delegate: (id: string) =>
      gateway.receive({ type: "session.delegation.created", delegation: { id, target: "client" } }),
  };
}

describe("backend transcript", () => {
  const delta = (role: "user" | "assistant", text: string, listeningSound = false) => ({
    role,
    text,
    listeningSound,
  });

  it("merges consecutive deltas into one message per turn and drops fillers", () => {
    expect(
      backendTranscript([
        delta("assistant", "Can a river"),
        delta("assistant", "be a person?"),
        delta("user", "I think"),
        delta("user", "mm-hmm", true),
        delta("user", " it depends on who speaks for it."),
      ]),
    ).toEqual([
      { role: "assistant", content: "Can a river be a person?" },
      { role: "user", content: "I think it depends on who speaks for it." },
    ]);
  });

  it("keeps a whole 20-minute interview, so early points stay in view", () => {
    const turns = Array.from({ length: 70 }, (_, i) =>
      delta(i % 2 ? "user" : "assistant", `turn ${i}`),
    );
    const messages = backendTranscript(turns);
    expect(messages).toHaveLength(70);
    expect(messages[0]).toEqual({ role: "assistant", content: "turn 0" });
    expect(messages.some(({ content }) => String(content).includes("omitted"))).toBe(false);
  });

  it("keeps only the recent turns and says that earlier ones are omitted", () => {
    const total = BACKEND_HISTORY_TURNS + 18;
    const turns = Array.from({ length: total }, (_, i) =>
      delta(i % 2 ? "user" : "assistant", `turn ${i}`),
    );
    const messages = backendTranscript(turns);
    expect(messages).toHaveLength(BACKEND_HISTORY_TURNS + 1);
    expect(messages[0]).toEqual({
      role: "user",
      content: "[Earlier discussion omitted: 18 turns.]",
    });
    expect(messages.at(-1)).toEqual({ role: "user", content: `turn ${total - 1}` });

    // When the first kept turn is the student's, the note joins it to keep roles alternating.
    const fromStudent = backendTranscript(turns.slice(0, total - 1));
    expect(fromStudent[0]).toEqual({
      role: "user",
      content: "[Earlier discussion omitted: 17 turns.]\nturn 17",
    });
    expect(fromStudent).toHaveLength(BACKEND_HISTORY_TURNS);
  });

  it("sends the whole interview when the student asks for feedback", () => {
    const turns = Array.from({ length: 30 }, (_, i) =>
      delta(i % 2 ? "user" : "assistant", `turn ${i}`),
    );
    const messages = backendTranscript([...turns, delta("user", "Could I have some feedback?")]);
    expect(messages).toHaveLength(30);
    expect(messages.some(({ content }) => String(content).includes("omitted"))).toBe(false);
  });

  it("treats backchannel and hesitation sounds as fillers, not reasoning", () => {
    for (const filler of ["Mm-hmm.", "uh-huh", "Um,", "erm...", "Hmm", "mm"]) {
      expect(isListeningSound(filler)).toBe(true);
    }
    for (const words of ["Um, I think so", "no", "yes", "mmm, rivers"]) {
      expect(isListeningSound(words)).toBe(false);
    }
  });
});

describe("live delegation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    mocks.streamText.mockReset().mockImplementation(fakeStream);
    mocks.authenticate.mockResolvedValue({ user: { email: "tester@example.com" }, supabase: {} });
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("waits for the student to pause, then asks once with their whole point", async () => {
    const interview = await startInterview();
    interview.say("Can a river be a person?", "assistant");
    interview.say("Rivers are shaped by people");
    interview.delegate("d1");

    await vi.advanceTimersByTimeAsync(500);
    interview.say("and by dams too.");
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS - 100);
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.messages).toEqual([
      { role: "assistant", content: "Can a river be a person?" },
      { role: "user", content: "Rivers are shaped by people and by dams too." },
    ]);

    calls[0]!.succeed("Who decided what the dam was for?");
    await vi.advanceTimersByTimeAsync(0);
    expect(interview.commentary()).toEqual([
      expect.objectContaining({
        delegation_id: "d1",
        content: "Who decided what the dam was for?",
      }),
    ]);
  });

  it("keeps an in-flight result when the student only makes a listening sound", async () => {
    const interview = await startInterview();
    interview.say("Borders are drawn by whoever wins wars.");
    interview.delegate("d1");
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS);
    expect(calls).toHaveLength(1);

    interview.say("mm-hmm");
    expect(calls[0]!.signal.aborted).toBe(false);
    calls[0]!.succeed("What about borders drawn by treaty?");
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS * 2);

    expect(calls).toHaveLength(1);
    expect(interview.commentary().map(({ content }) => content)).toEqual([
      "What about borders drawn by treaty?",
    ]);
  });

  it("drops a stale result when the student says more, and re-asks after their pause", async () => {
    const interview = await startInterview();
    interview.say("Disasters are natural.");
    interview.delegate("d1");
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS);
    expect(calls).toHaveLength(1);

    interview.say("Actually, who builds where matters.");
    expect(calls[0]!.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS - 1);
    expect(calls).toHaveLength(1);
    expect(interview.commentary()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.messages.at(-1)).toEqual({
      role: "user",
      content: "Disasters are natural. Actually, who builds where matters.",
    });
    calls[1]!.succeed("Who decides where people can afford to build?");
    await vi.advanceTimersByTimeAsync(0);
    expect(interview.commentary().map(({ content }) => content)).toEqual([
      "Who decides where people can afford to build?",
    ]);
  });

  it("falls back silently in character when the backend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const interview = await startInterview();
    interview.say("Maps are neutral.");
    interview.delegate("d1");
    await vi.advanceTimersByTimeAsync(STUDENT_PAUSE_MS);
    calls[0]!.fail();
    await vi.advanceTimersByTimeAsync(0);

    expect(interview.commentary()).toEqual([
      expect.objectContaining({ delegation_id: "d1", content: DELEGATION_FALLBACK }),
    ]);
    expect(DELEGATION_FALLBACK).not.toMatch(/backend|try again|error|fail/i);
    expect(calls).toHaveLength(1);
  });
});

describe("turn analyst and director in the live relay", () => {
  let latestInterview: Awaited<ReturnType<typeof startInterview>> | undefined;
  const analystReply = JSON.stringify({
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
  });

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    mocks.streamText.mockReset().mockImplementation(fakeStream);
    mocks.generateText.mockReset().mockResolvedValue({ text: analystReply });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function exchange(email: string) {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, interviewId: "00000000-0000-4000-8000-000000000001" },
      error: null,
    });
    mocks.authenticate.mockResolvedValue({ user: { email }, supabase: { rpc } });
    const interview = await startInterview();
    latestInterview = interview;
    interview.say("Who owns the outdoors?", "assistant");
    interview.say("Whoever paid for the land, because they bought it.");
    // The tutor starts replying, so the student's turn has ended.
    interview.say("Right, but consider footpaths.", "assistant");
    if (email === "tester@example.com")
      await vi.waitFor(async () => {
        await vi.advanceTimersByTimeAsync(0);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"interview.turn"'));
      });
    else await vi.advanceTimersByTimeAsync(1000);
    const notes = interview.gateway.sent.filter(
      ({ type, content }) =>
        type === "session.instructions.append" && typeof content === "string" && content !== "",
    );
    // This harness never marks the browser ready, so no greeting is sent: any instruction
    // appended to the session is a steering note.
    return { notes };
  }

  it("analyses a tester's turns and steers their tutor", async () => {
    const { notes } = await exchange("tester@example.com");
    expect(mocks.generateText).toHaveBeenCalledOnce();
    // The student gave a reason in the opening, so the director moves on to the baseline.
    expect(notes.map(({ content }) => content)).toEqual([expect.stringMatching(/starting level/)]);
  });

  it("does not analyse a student's turns, so no model call is spent on them", async () => {
    const { notes } = await exchange("student@example.com");
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(notes).toEqual([]);
    const logged = vi.mocked(console.log).mock.calls.map(([line]) => String(line));
    expect(logged.some((line) => line.includes('"interview.turn"'))).toBe(false);
  });

  it("scores the finished interview with the evaluation metrics, without what was said", async () => {
    await exchange("student@example.com");
    const interview = latestInterview!;
    // The voice gateway hanging up finishes the call.
    const onClose = vi.mocked(interview.gateway.live.onClose).mock.calls[0]?.[0] as () => void;
    onClose();
    const lines = vi.mocked(console.log).mock.calls.map(([line]) => String(line));
    const metrics = lines.find((line) => line.includes('"interview.metrics"'));
    expect(metrics).toBeDefined();
    expect(JSON.parse(metrics!)).toMatchObject({
      tutorId: "geography",
      studentTurnCount: 1,
      tutorTurnCount: 2,
    });
    expect(metrics).not.toContain("Whoever paid");
  });
});
