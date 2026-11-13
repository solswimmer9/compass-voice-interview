// Dr River on topic cards for tester accounts only (task 2, 12 November 2026).
// Testers get a prompt built from approved geography cards; everyone else keeps the fixed prompt
// byte for byte; drafts never reach any prompt; access decided only by tester account.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardsFor, tutorById, type Tutor } from "@/content";
import { buildGeographySession, GEOGRAPHY_SUBJECT } from "@/lib/geography.server";
import {
  DR_RIVER_BRIEFING,
  NOTES_CONTEXT,
  openingInstructions,
  readingOpeningInstructions,
  REASONING_GUIDE,
} from "@/lib/interview-briefing";
import { READINGS } from "@/lib/readings";
import { objectMidwaySection, selectObject } from "@/content/objects";
import {
  bindLiveConnection,
  type LiveExecutionContext,
  type LiveSocket,
} from "@/lib/live-relay.server";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  rpc: vi.fn(),
  connect: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@/lib/request-auth.server", () => ({
  authenticateAccessToken: mocks.authenticate,
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText: mocks.streamText,
}));

const geography = tutorById("geography") as Tutor;
const approvedIds = new Set(cardsFor("geography").map((card) => card.id));
const drafts = geography.cards.filter((card) => card.status !== "approved");
const interviewId = "04432c37-afd4-48d7-bf18-460f181d98b4";
const TESTER = "owner@example.com";
const config = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  key: "server-key",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

// A verbatim copy of the fixed prompt in live-relay.server.ts on main (as of 097ad37, the no-filler wording).
// Students must keep getting exactly this.
const LEGACY_READINGS = `PRACTICE READINGS
The app lists these articles for students to read before an interview. When the interview opens on one of these readings, or the student says they have read one, spend the first 10 to 15 minutes on it, as some colleges do: check they understood it, then test its argument. Do not claim to have read the full article; work from what the student says and this summary. In a reading interview, raise your own thoughts on that article one at a time, as challenges rather than lectures. In any other interview, do not bring up these readings or thoughts unless the student does.
${READINGS.map((r) => `- "${r.title}" (${r.source}): ${r.context} Questions: ${r.questions.join(" ")} Your own thoughts (only in an interview on this reading): ${r.tutorThoughts.join(" ")}`).join("\n")}`;

/**
 * Every normal (non-reading) interview also plans Dr River's approved chart for partway through
 * (owner's decision, 13 November 2026). That section is appended after the prompt, unchanged
 * otherwise; reading interviews get no chart. Testers get the same chart.
 */
const withChart = (prompt: string) =>
  `${prompt}\n\n${objectMidwaySection(selectObject("geography", { includeDrafts: true })!)}`;

const LEGACY_INSTRUCTIONS = `${DR_RIVER_BRIEFING}

${NOTES_CONTEXT}

${LEGACY_READINGS}

Voice: calm, unhurried and soothing, like a gentle documentary narrator; speak slowly with natural pauses.
Mannerisms: Sound like a real British academic in a supervision, not a presenter. Keep most turns to one or two short sentences. Open replies with varied natural bridges, for example "Right, but consider...", "Fair enough, though...", "Let's pause there for a second...", "Hang on, go back to...", "I wonder whether...". Never use the same bridge twice in a row, and sometimes use none.
Pause policy: Students think aloud and often pause mid-thought. Treat a short silence, a trailing "um", "so..." or an unfinished sentence as thinking, not the end of their turn: wait and stay quiet. Respond only once they have clearly finished a point. If they go quiet for a long while, gently say something brief like "Take your time" or "Think aloud if it helps", then wait again. Never fill silence with a new question or an answer.
No-filler rule: Never use vocalised fillers or stall phrases such as "hmmm", "let me think", "let me see", "give me a second", "um", "er" or "so...". Never narrate that you are thinking or deciding what to say. If you need a moment, stay silent rather than filling it with a sound.
Interruption policy: Stop speaking and listen when the candidate interrupts.
Delegation policy:
Backend tools: A careful reasoning assistant that analyses the candidate's argument and suggests the sharpest follow-up challenge.
Delegate to the backend when: The candidate gives a long or complex argument and you need a precise counter-argument, or they ask for detailed feedback on the interview.
Do not delegate to the backend when: Greeting, asking the opening question, short follow-ups, hints, or clarifications. Wait for the backend result before presenting it.`;

const LEGACY_BACKEND_SYSTEM =
  "You support a spoken Cambridge geography admissions interviewer. Transcripts may be incomplete or corrected; use the latest correction. " +
  "Identify the weakest assumption in the candidate's latest reasoning and return one sharp, interviewer-style follow-up challenge, " +
  "or, if feedback was requested, two strengths and two improvements. Do not give the model answer. At most 80 words, spoken style. You have no tools.\n\n" +
  REASONING_GUIDE;

/** Texts that only a draft card would put in a prompt. */
function draftTexts() {
  return drafts.flatMap((card) => [card.opening, card.live]).filter((text) => text.length > 20);
}

type Sent = Record<string, unknown>;

function harness() {
  let fromBrowser: ((data: unknown) => void) | undefined;
  let fromGateway: ((data: unknown) => void) | undefined;
  const events: Sent[] = [];
  const sent: Sent[] = [];
  const browser: LiveSocket = {
    readyState: 1,
    send: (data) => void events.push(JSON.parse(data) as Sent),
    close: vi.fn(),
    onMessage: (handler) => void (fromBrowser = handler),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  const gateway: LiveSocket = {
    readyState: 1,
    send: (data) => void sent.push(JSON.parse(data) as Sent),
    close: vi.fn(),
    onMessage: (handler) => void (fromGateway = handler),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  mocks.connect.mockResolvedValue(gateway);
  const execution: LiveExecutionContext = { waitUntil: (task) => void task };
  bindLiveConnection(browser, config, execution, mocks.connect);
  return {
    events,
    sent,
    start(extra: Record<string, unknown> = {}) {
      fromBrowser?.(
        JSON.stringify({
          type: "app.start",
          sdp: "test-offer",
          openingTurn: 1,
          accessToken: "valid-access-token",
          environment: "live",
          ...extra,
        }),
      );
    },
    browserSays: (event: Sent) => fromBrowser?.(JSON.stringify(event)),
    gatewaySays: (event: Sent) => fromGateway?.(JSON.stringify(event)),
    instructions: () =>
      (sent.find((m) => m["type"] === "session.start")?.["session"] as { instructions: string })
        .instructions,
    greeting: () =>
      sent.find((m) => m["type"] === "session.instructions.append")?.["content"] as string,
  };
}

type Harness = ReturnType<typeof harness>;

async function startAndGreet(extra: Record<string, unknown> = {}): Promise<Harness> {
  const h = harness();
  h.start(extra);
  await vi.waitFor(() => expect(h.sent.some((m) => m["type"] === "session.start")).toBe(true));
  h.gatewaySays({ type: "gateway.session.created", session: { id: "s1" } });
  h.browserSays({ type: "app.ready" });
  await vi.waitFor(() => expect(h.greeting()).toBeTypeOf("string"));
  return h;
}

/** Asks the backend model once and returns the system prompt it was given. */
async function backendSystem(h: Harness): Promise<string> {
  h.gatewaySays({ type: "session.input_transcript.delta", delta: "I think rivers are fluid." });
  h.gatewaySays({ type: "session.delegation.created", delegation: { id: "d1", target: "client" } });
  await vi.waitFor(() => expect(mocks.streamText).toHaveBeenCalledOnce(), { timeout: 2000 });
  return (mocks.streamText.mock.calls[0]?.[0] as { system: string }).system;
}

function signIn(email: string | null) {
  mocks.authenticate.mockResolvedValue(
    email === null ? null : { user: { email }, supabase: { rpc: mocks.rpc } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  signIn("student@example.com");
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "consume_interview_credit"
        ? { data: { allowed: true, interviewId }, error: null }
        : { data: true, error: null },
    ),
  );
  mocks.streamText.mockImplementation(() => ({
    fullStream: (async function* () {
      yield { type: "finish-step" };
      yield { type: "finish", finishReason: "stop" };
    })(),
    text: Promise.resolve("Why?"),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("buildGeographySession", () => {
  it("has drafts to keep out, and approved cards to use", () => {
    expect(approvedIds.size).toBeGreaterThan(0);
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("uses approved cards only, for every opening turn and strand", async () => {
    const strands = [undefined, "human", "physical", "no-such-strand"];
    for (const strand of strands) {
      for (let turn = 0; turn < approvedIds.size + drafts.length; turn++) {
        const session = await buildGeographySession({ openingTurn: turn, strand });
        expect(session.cardIds.length).toBeGreaterThan(0);
        for (const id of session.cardIds) expect(approvedIds.has(id), id).toBe(true);
        for (const text of draftTexts()) expect(session.liveInstructions).not.toContain(text);
        expect(session.liveInstructions).toContain("You are Dr River");
        expect(session.tutorId).toBe("geography");
      }
    }
  });

  it("uses approved cards only with no seed (random opening)", async () => {
    for (let i = 0; i < 30; i++) {
      const session = await buildGeographySession({});
      for (const id of session.cardIds) expect(approvedIds.has(id), id).toBe(true);
    }
  });

  it("opens a reading interview on the reading, with approved cards after it", async () => {
    for (const reading of READINGS) {
      const session = await buildGeographySession({ openingTurn: 3, readingId: reading.id });
      expect(session.readingId).toBe(reading.id);
      expect(session.opening).toContain(reading.title);
      expect(session.liveInstructions).toContain(reading.context);
      expect(new TextEncoder().encode(session.opening).length).toBeLessThan(480);
      for (const id of session.cardIds) expect(approvedIds.has(id), id).toBe(true);
    }
  });

  it("ignores an unknown reading id", async () => {
    const plain = await buildGeographySession({ openingTurn: 2 });
    expect(await buildGeographySession({ openingTurn: 2, readingId: "made-up" })).toEqual(plain);
  });
});

describe("Dr River on topic cards in the live relay", () => {
  it("gives a signed-in tester the card-based prompt, greeting and backend context", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    signIn(TESTER);
    const expected = await buildGeographySession({ openingTurn: 1 });

    const h = await startAndGreet();

    expect(h.instructions()).toBe(withChart(expected.liveInstructions));
    expect(h.instructions()).not.toBe(withChart(LEGACY_INSTRUCTIONS));
    expect(h.greeting()).toBe(expected.opening);
    for (const text of draftTexts()) expect(h.instructions()).not.toContain(text);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(h.events).toContainEqual({ type: "app.interview.started", interviewId: "preview" });
    const system = await backendSystem(h);
    expect(system).toContain(`spoken ${GEOGRAPHY_SUBJECT} admissions interviewer`);
    expect(system).toContain(expected.backendContext);
  });

  it("gives a tester a card-based reading interview", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    signIn(TESTER);
    const reading = READINGS[0]!;
    const expected = await buildGeographySession({ openingTurn: 1, readingId: reading.id });

    const h = await startAndGreet({ readingId: reading.id });

    expect(h.instructions()).toBe(expected.liveInstructions);
    expect(h.greeting()).toBe(expected.opening);
    const line = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0])) as Sent;
    expect(line).toMatchObject({ event: "interview.session", tutorId: "geography" });
    expect(line["readingId"]).toBe(reading.id);
    expect(JSON.stringify(line)).not.toContain(TESTER);
  });

  it("keeps a signed-in student on today's exact prompt, greeting and backend brief", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    for (const turn of [0, 1, 7, 13]) {
      vi.clearAllMocks();
      const h = await startAndGreet({ openingTurn: turn });
      expect(h.instructions()).toBe(withChart(LEGACY_INSTRUCTIONS));
      expect(h.greeting()).toBe(openingInstructions(turn).trim());
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", {
        p_environment: "live",
      });
      expect(h.events).toContainEqual({ type: "app.interview.started", interviewId });
      if (turn === 0) expect(await backendSystem(h)).toBe(LEGACY_BACKEND_SYSTEM);
    }
    expect(console.log).not.toHaveBeenCalled();
  });

  it("keeps a student's reading interview on today's exact prompt and greeting", async () => {
    const reading = READINGS[0]!;
    const h = await startAndGreet({ readingId: reading.id });
    expect(h.instructions()).toBe(LEGACY_INSTRUCTIONS);
    expect(h.greeting()).toBe(readingOpeningInstructions(reading).trim());
  });

  it("treats a student with no tester list set as a student", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "");
    signIn(TESTER);
    const h = await startAndGreet();
    expect(h.instructions()).toBe(withChart(LEGACY_INSTRUCTIONS));
    expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", { p_environment: "live" });
  });

  it("refuses a signed-out visitor exactly as before, whatever the tester list", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    signIn(null);
    const h = harness();
    h.start();
    await vi.waitFor(() =>
      expect(h.events).toContainEqual({
        type: "app.error",
        error: { message: "Your sign-in has expired. Please sign in again." },
      }),
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("refuses a start with no access token before signing in", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    const h = harness();
    h.start({ accessToken: undefined });
    await vi.waitFor(() =>
      expect(h.events).toContainEqual({
        type: "app.error",
        error: { message: "Please sign in again before starting your interview." },
      }),
    );
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("still restores a student's credit when the voice connection fails", async () => {
    const h = harness();
    mocks.connect.mockRejectedValue(new Error("Voice startup failed for this test"));
    h.start();
    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("release_interview_credit", {
        p_interview_id: interviewId,
      }),
    );
  });

  it("does not let environment, build mode or the start message make a student a tester", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MODE", "development");
    for (const environment of ["sandbox", "live"]) {
      vi.clearAllMocks();
      const h = await startAndGreet({
        environment,
        tester: true,
        tutorId: "geography",
        hostname: "id-preview--1234.lovable.app",
      });
      expect(h.instructions()).toBe(withChart(LEGACY_INSTRUCTIONS));
      expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", {
        p_environment: environment,
      });
    }
  });

  it("gives a tester the card prompt whatever the environment", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", ` ${TESTER.toUpperCase()} `);
    signIn(TESTER);
    vi.stubEnv("NODE_ENV", "production");
    const expected = await buildGeographySession({ openingTurn: 1 });
    for (const environment of ["sandbox", "live", undefined]) {
      vi.clearAllMocks();
      const h = await startAndGreet({ environment });
      expect(h.instructions()).toBe(withChart(expected.liveInstructions));
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  });
});

describe("a failed card build", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/geography.server");
    vi.resetModules();
  });

  it("stops a tester's interview with no credit used and no voice connection", async () => {
    vi.resetModules();
    vi.doMock("@/lib/geography.server", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/geography.server")>()),
      buildGeographySession: vi.fn().mockRejectedValue(new Error("No cards for this test")),
    }));
    const relay = await import("@/lib/live-relay.server");
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    signIn(TESTER);
    let handler: ((data: unknown) => void) | undefined;
    const events: Sent[] = [];
    relay.bindLiveConnection(
      {
        readyState: 1,
        send: (data) => void events.push(JSON.parse(data) as Sent),
        close: vi.fn(),
        onMessage: (h) => void (handler = h),
        onClose: vi.fn(),
        onError: vi.fn(),
      },
      config,
      { waitUntil: (task) => void task },
      mocks.connect,
    );
    handler?.(
      JSON.stringify({
        type: "app.start",
        sdp: "test-offer",
        accessToken: "valid-access-token",
        environment: "live",
      }),
    );
    await vi.waitFor(() =>
      expect(events).toContainEqual({
        type: "app.error",
        error: { message: "No cards for this test" },
      }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("never builds cards for a student", async () => {
    vi.resetModules();
    const build = vi.fn().mockRejectedValue(new Error("Should not be called"));
    vi.doMock("@/lib/geography.server", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/geography.server")>()),
      buildGeographySession: build,
    }));
    const relay = await import("@/lib/live-relay.server");
    vi.stubEnv("PREVIEW_TESTER_EMAILS", TESTER);
    let handler: ((data: unknown) => void) | undefined;
    relay.bindLiveConnection(
      {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        onMessage: (h) => void (handler = h),
        onClose: vi.fn(),
        onError: vi.fn(),
      },
      config,
      { waitUntil: (task) => void task },
      mocks.connect,
    );
    mocks.connect.mockRejectedValue(new Error("stop here"));
    handler?.(
      JSON.stringify({
        type: "app.start",
        sdp: "test-offer",
        accessToken: "valid-access-token",
        environment: "live",
      }),
    );
    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
    expect(build).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", { p_environment: "live" });
  });
});
