import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindLiveConnection,
  CLOSING_INSTRUCTIONS,
  MAX_RECAP_CHARS,
  parseResumeRequest,
  RESUME_GREETING,
  sanitizeRecap,
  TIME_UP_MESSAGE,
  WRAP_UP_INSTRUCTIONS,
  type LiveExecutionContext,
  type LiveSocket,
} from "@/lib/live-relay.server";
import { INTERVIEW_MINUTES } from "@/lib/limits";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  row: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("@/lib/request-auth.server", () => ({
  authenticateAccessToken: mocks.authenticate,
}));

const userId = "8d0f7a2e-1c4b-4c55-9a43-2b8f1c6e0d11";
const interviewId = "04432c37-afd4-48d7-bf18-460f181d98b4";
const resumedId = "6f9b1d2a-3c4e-4f5a-8b6c-7d8e9f0a1b2c";
const LIMIT_MS = INTERVIEW_MINUTES * 60_000;
const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const config = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  key: "server-key",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

type Sent = { type?: unknown; [key: string]: unknown };

function fakeSocket() {
  let onMessage: ((data: unknown) => void) | undefined;
  const sent: Sent[] = [];
  const socket: LiveSocket = {
    readyState: 1,
    send(data) {
      sent.push(JSON.parse(data) as Sent);
    },
    close: vi.fn(),
    onMessage(handler) {
      onMessage = handler;
    },
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  return {
    socket,
    sent,
    receive(event: object) {
      onMessage?.(JSON.stringify(event));
    },
  };
}

function executionContext(): LiveExecutionContext {
  return {
    waitUntil(task) {
      void task;
    },
  };
}

async function flush() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

function appStart(extra: Record<string, unknown> = {}) {
  return {
    type: "app.start",
    sdp: "test-offer",
    openingTurn: 1,
    accessToken: "valid-access-token",
    environment: "live",
    ...extra,
  };
}

function interviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: resumedId,
    user_id: userId,
    created_at: new Date(NOW - 5 * 60_000).toISOString(),
    feedback_used: false,
    environment: "live",
    ...overrides,
  };
}

/** Binds a relay, starts it and returns the browser and gateway fakes. */
async function startCall(start: Record<string, unknown> = appStart()) {
  const browser = fakeSocket();
  const gateway = fakeSocket();
  mocks.connect.mockResolvedValue(gateway.socket);
  bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);
  browser.receive(start);
  await flush();
  return { browser, gateway };
}

function gatewaySessionCreated(gateway: ReturnType<typeof fakeSocket>) {
  gateway.receive({ type: "gateway.session.created", session: { id: "live-session" } });
}

function released() {
  return mocks.rpc.mock.calls.some(([name]) => name === "release_interview_credit");
}

describe("live interview resume, time cues and refunds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(() => mocks.row()),
    };
    mocks.from.mockImplementation(() => query);
    mocks.row.mockResolvedValue({ data: interviewRow(), error: null });
    mocks.authenticate.mockResolvedValue({
      user: { id: userId, email: "student@example.com" },
      supabase: { rpc: mocks.rpc, from: mocks.from },
    });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "consume_interview_credit") {
        return Promise.resolve({ data: { allowed: true, interviewId }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("resuming a dropped interview", () => {
    it("reuses the student's own interview without consuming another credit", async () => {
      const { browser, gateway } = await startCall(
        appStart({ resumeInterviewId: resumedId, recap: "You: Rivers shape cities." }),
      );

      expect(mocks.from).toHaveBeenCalledWith("interview_sessions");
      expect(mocks.rpc).not.toHaveBeenCalledWith("consume_interview_credit", expect.anything());
      expect(browser.sent).toContainEqual({
        type: "app.interview.started",
        interviewId: resumedId,
        resumed: true,
      });
      const start = gateway.sent.find((event) => event.type === "session.start") as {
        session: { instructions: string };
      };
      expect(start.session.instructions).toContain("RESUMED INTERVIEW");
      expect(start.session.instructions).toContain("You: Rivers shape cities.");
    });

    it("asks Dr River to acknowledge the dropped line instead of restarting", async () => {
      const { browser, gateway } = await startCall(
        appStart({ resumeInterviewId: resumedId, recap: "You: Rivers shape cities." }),
      );
      gatewaySessionCreated(gateway);
      browser.receive({ type: "app.ready" });

      const greeting = gateway.sent.find((event) => event.type === "session.instructions.append");
      expect(greeting?.["content"]).toBe(RESUME_GREETING);
      expect(new TextEncoder().encode(RESUME_GREETING).length).toBeLessThan(480);
    });

    it.each([
      ["belongs to someone else or does not exist", null],
      ["has already been assessed", interviewRow({ feedback_used: true })],
      ["was started in another payments environment", interviewRow({ environment: "sandbox" })],
      [
        "is past its time limit",
        interviewRow({ created_at: new Date(NOW - LIMIT_MS - 1000).toISOString() }),
      ],
      [
        "has too little time left",
        interviewRow({ created_at: new Date(NOW - LIMIT_MS + 30_000).toISOString() }),
      ],
      ["belongs to another user id", interviewRow({ user_id: "someone-else" })],
    ])("refuses to resume an interview that %s", async (_label, row) => {
      mocks.row.mockResolvedValue({ data: row, error: null });

      const { browser } = await startCall(appStart({ resumeInterviewId: resumedId }));

      expect(browser.sent).toContainEqual({
        type: "app.error",
        error: {
          message: "This interview can no longer be resumed. Please start a new interview.",
        },
      });
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("refuses a resume for a non-tester using the preview id", async () => {
      const { browser } = await startCall(appStart({ resumeInterviewId: "preview" }));

      expect(browser.sent).toContainEqual(expect.objectContaining({ type: "app.error" }));
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it.each([
      ["a malformed id", { resumeInterviewId: "not-a-uuid" }],
      ["a non-string id", { resumeInterviewId: 42 }],
      ["an oversized recap", { resumeInterviewId: resumedId, recap: "x".repeat(4001) }],
      ["a recap that is not text", { resumeInterviewId: resumedId, recap: ["You: hi"] }],
      ["a recap without an interview", { recap: "You: hi" }],
    ])("rejects %s before signing in", async (_label, extra) => {
      const { browser } = await startCall(appStart(extra));

      expect(browser.sent).toContainEqual(expect.objectContaining({ type: "app.error" }));
      expect(mocks.authenticate).not.toHaveBeenCalled();
      expect(mocks.connect).not.toHaveBeenCalled();
    });

    it("never refunds a credit on a resumed connection, even when it fails to start", async () => {
      mocks.connect.mockRejectedValue(new Error("Voice startup failed for this test"));
      const browser = fakeSocket();
      bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

      browser.receive(appStart({ resumeInterviewId: resumedId }));
      await flush();

      expect(browser.sent).toContainEqual(
        expect.objectContaining({
          type: "app.error",
          error: { message: "Voice startup failed for this test" },
        }),
      );
      expect(released()).toBe(false);
    });

    it("lets a listed tester resume freely without credits or a database check", async () => {
      vi.stubEnv("PREVIEW_TESTER_EMAILS", "student@example.com");

      const { browser } = await startCall(appStart({ resumeInterviewId: "preview" }));

      expect(mocks.connect).toHaveBeenCalledOnce();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(browser.sent).toContainEqual({
        type: "app.interview.started",
        interviewId: "preview",
        resumed: true,
      });
    });

    it("limits a resumed interview to the time left from the original start", async () => {
      const startedAgo = 12 * 60_000;
      mocks.row.mockResolvedValue({
        data: interviewRow({ created_at: new Date(NOW - startedAgo).toISOString() }),
        error: null,
      });
      const { browser, gateway } = await startCall(appStart({ resumeInterviewId: resumedId }));
      gatewaySessionCreated(gateway);
      const remaining = LIMIT_MS - startedAgo;

      expect(browser.sent).toContainEqual({ type: "app.time.limit", remainingMs: remaining });
      await vi.advanceTimersByTimeAsync(remaining - 1000);
      expect(browser.sent).not.toContainEqual(expect.objectContaining({ type: "app.time_up" }));
      await vi.advanceTimersByTimeAsync(1000);
      expect(browser.sent).toContainEqual({ type: "app.time_up", message: TIME_UP_MESSAGE });
      expect(gateway.sent).toContainEqual({ type: "session.close" });
    });
  });

  describe("graceful ending", () => {
    it("cues Dr River to wrap up, then to close, then ends without an error", async () => {
      const { browser, gateway } = await startCall();
      gatewaySessionCreated(gateway);
      const contents = () =>
        gateway.sent
          .filter((event) => event.type === "session.instructions.append")
          .map((event) => event["content"]);

      await vi.advanceTimersByTimeAsync(LIMIT_MS - 150_000 - 1);
      expect(contents()).not.toContain(WRAP_UP_INSTRUCTIONS);
      await vi.advanceTimersByTimeAsync(1);
      expect(contents()).toContain(WRAP_UP_INSTRUCTIONS);

      await vi.advanceTimersByTimeAsync(90_000);
      expect(contents()).toContain(CLOSING_INSTRUCTIONS);
      const closing = gateway.sent.find((event) => event["content"] === CLOSING_INSTRUCTIONS)!;
      gateway.receive({
        type: "session.instructions.appended",
        client_event_id: closing["event_id"],
      });
      expect(gateway.sent.at(-1)).toEqual(
        expect.objectContaining({ type: "session.commentary.append", delegation_id: null }),
      );

      await vi.advanceTimersByTimeAsync(60_000);
      expect(browser.sent).toContainEqual({ type: "app.time_up", message: TIME_UP_MESSAGE });
      expect(browser.sent).not.toContainEqual(expect.objectContaining({ type: "app.error" }));
      expect(gateway.sent).toContainEqual({ type: "session.close" });
    });

    it("keeps every time cue inside the per-append size limit", () => {
      for (const cue of [WRAP_UP_INSTRUCTIONS, CLOSING_INSTRUCTIONS]) {
        expect(new TextEncoder().encode(cue).length).toBeLessThan(480);
      }
    });
  });

  describe("refunds use only what the server saw", () => {
    it("refunds when the voice session ends quickly with no student speech", async () => {
      const { browser, gateway } = await startCall();
      gatewaySessionCreated(gateway);
      browser.receive({ type: "app.ready" });
      await vi.advanceTimersByTimeAsync(5000);

      browser.receive({ type: "session.close" });
      await flush();

      expect(mocks.rpc).toHaveBeenCalledWith("release_interview_credit", {
        p_interview_id: interviewId,
      });
    });

    it("does not refund once the student has spoken", async () => {
      const { browser, gateway } = await startCall();
      gatewaySessionCreated(gateway);
      gateway.receive({ type: "session.input_transcript.delta", delta: "Well, I think" });
      await vi.advanceTimersByTimeAsync(5000);

      browser.receive({ type: "session.close" });
      await flush();

      expect(released()).toBe(false);
    });

    it("does not refund a long call even if the browser never sent app.ready", async () => {
      const { browser, gateway } = await startCall();
      gatewaySessionCreated(gateway);
      await vi.advanceTimersByTimeAsync(30_000);

      browser.receive({ type: "session.close" });
      await flush();

      expect(released()).toBe(false);
    });

    it("refunds when the gateway session was never created", async () => {
      const { browser } = await startCall();

      browser.receive({ type: "session.close" });
      await flush();

      expect(mocks.rpc).toHaveBeenCalledWith("release_interview_credit", {
        p_interview_id: interviewId,
      });
    });
  });
});

describe("resume request validation", () => {
  it("accepts a uuid and keeps only the latest part of a long recap", () => {
    const recap = `${"a".repeat(500)} ${"b".repeat(MAX_RECAP_CHARS)}`;
    const parsed = parseResumeRequest({ resumeInterviewId: resumedId.toUpperCase(), recap });

    expect(parsed?.interviewId).toBe(resumedId);
    expect(parsed?.recap).toHaveLength(MAX_RECAP_CHARS);
    expect(parsed?.recap).not.toContain("a");
  });

  it("returns nothing for a normal start", () => {
    expect(parseResumeRequest({})).toBeUndefined();
  });

  it("strips markup, control and invisible characters from the recap", () => {
    expect(sanitizeRecap("You: <b>hi</b>\u0007​ there\r\n\n\n\nDr River:  ok")).toBe(
      "You: b hi /b there\n\nDr River: ok",
    );
  });
});
