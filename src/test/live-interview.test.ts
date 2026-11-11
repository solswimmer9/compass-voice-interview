import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardsFor, tutorById, type Tutor } from "@/content";
import { buildSession } from "@/content/build-session";
import { selectCards } from "@/content/select-cards";
import { READINGS } from "@/lib/readings";
import {
  bindLiveConnection,
  type LiveExecutionContext,
  type LiveSocket,
} from "@/lib/live-relay.server";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  rpc: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("@/lib/request-auth.server", () => ({
  authenticateAccessToken: mocks.authenticate,
}));
const interviewId = "04432c37-afd4-48d7-bf18-460f181d98b4";
const config = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  key: "server-key",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

function browserSocket() {
  let onMessage: ((data: unknown) => void) | undefined;
  const events: Array<Record<string, unknown>> = [];
  const socket: LiveSocket = {
    readyState: 1,
    send(data) {
      events.push(JSON.parse(data) as Record<string, unknown>);
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
    events,
    message(event: Record<string, unknown>) {
      onMessage?.(JSON.stringify(event));
    },
    start(extra: Record<string, unknown> = {}) {
      onMessage?.(
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
  };
}

function executionContext(): LiveExecutionContext {
  return {
    waitUntil(task) {
      void task;
    },
  };
}

describe("Lovable live interview access", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.authenticate.mockResolvedValue({
      user: { email: "owner@example.com" },
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "consume_interview_credit") {
        return Promise.resolve({ data: { allowed: true, interviewId }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    mocks.connect.mockRejectedValue(new Error("Voice startup failed for this test"));
  });

  it("consumes one interview allowance before opening the voice connection", async () => {
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", {
      p_environment: "live",
    });
    expect(browser.events).toContainEqual(
      expect.objectContaining({ type: "app.interview.started", interviewId }),
    );
  });

  it("restores the exact interview allowance when the voice connection fails", async () => {
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("release_interview_credit", {
        p_interview_id: interviewId,
      }),
    );
    expect(browser.events).toContainEqual(
      expect.objectContaining({
        type: "app.error",
        error: { message: "Voice startup failed for this test" },
      }),
    );
  });

  it("refuses to start a voice interview without sign-in, even in preview", async () => {
    const browser = browserSocket();
    mocks.authenticate.mockResolvedValue(null);
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(expect.objectContaining({ type: "app.error" })),
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("lets a listed tester run unlimited voice interviews without using credits", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalledOnce());
    expect(mocks.rpc).not.toHaveBeenCalledWith("consume_interview_credit", expect.anything());
    expect(browser.events).toContainEqual(
      expect.objectContaining({ type: "app.interview.started", interviewId: "preview" }),
    );
  });

  it("makes signed-in non-testers use their interview credits", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "someone-else@example.com");
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", expect.anything()),
    );
  });
});

/** A gateway socket that records what the relay sends it. */
type GatewayMessage = { type?: string; content?: string; session?: unknown };

function gatewaySocket() {
  const sent: GatewayMessage[] = [];
  const socket: LiveSocket = {
    readyState: 1,
    send(data) {
      sent.push(JSON.parse(data) as GatewayMessage);
    },
    close: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  return { socket, sent };
}

function sessionStart(sent: GatewayMessage[]) {
  const start = sent.find((message) => message.type === "session.start");
  return start?.session as { instructions: string; model: string; audio: unknown } | undefined;
}

describe("live interview content layer", () => {
  const geography = tutorById("geography") as Tutor;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.authenticate.mockResolvedValue({
      user: { email: "owner@example.com" },
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "consume_interview_credit") {
        return Promise.resolve({ data: { allowed: true, interviewId }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function startWith(extra: Record<string, unknown> = {}) {
    const gateway = gatewaySocket();
    mocks.connect.mockResolvedValue(gateway.socket);
    const browser = browserSocket();
    const liveConfig = { ...config };
    bindLiveConnection(browser.socket, liveConfig, executionContext(), mocks.connect);
    browser.start(extra);
    return { browser, gateway };
  }

  it("starts a geography interview with no tutorId, built from the selected cards", async () => {
    const { browser, gateway } = await startWith();
    await vi.waitFor(() => expect(sessionStart(gateway.sent)).toBeDefined());

    const cards = selectCards(geography, [], { seed: 1 });
    const expected = await buildSession({ tutor: geography, cards });
    const session = sessionStart(gateway.sent)!;
    expect(session.instructions).toBe(expected.liveInstructions);
    expect(session.model).toBe(config.liveModel);
    expect(session.audio).toEqual({ output: { voice: "vesper" } });
    for (const card of cardsFor("geography")) {
      expect(session.instructions).not.toContain(card.deep);
    }
    expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", { p_environment: "live" });
    expect(browser.events).toContainEqual({
      type: "app.interview.started",
      interviewId,
      tutorId: "geography",
      cardIds: expected.cardIds,
      promptHash: expected.promptHash,
    });
  });

  it("logs one structured line of versions per interview, without transcript or user details", async () => {
    await startWith();
    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    const line = String(log.mock.calls[0]?.[0]);
    const entry = JSON.parse(line) as Record<string, string>;
    expect(Object.keys(entry).sort()).toEqual(
      [
        "cardIds",
        "event",
        "pedagogyVersion",
        "promptHash",
        "readingId",
        "tutorId",
        "tutorVersion",
      ].sort(),
    );
    expect(entry["tutorId"]).toBe("geography");
    expect(entry["tutorVersion"]).toBe(geography.version);
    expect(line).not.toContain("owner@example.com");
    expect(line).not.toContain("valid-access-token");
    expect(line).not.toContain(interviewId);
  });

  it("greets with the opening built from the first card, under 480 bytes", async () => {
    const { browser, gateway } = await startWith();
    await vi.waitFor(() => expect(sessionStart(gateway.sent)).toBeDefined());
    const fromGateway = vi.mocked(gateway.socket.onMessage).mock.calls[0]?.[0];
    fromGateway?.(JSON.stringify({ type: "gateway.session.created", session: { id: "s1" } }));
    browser.message({ type: "app.ready" });

    const expected = await buildSession({
      tutor: geography,
      cards: selectCards(geography, [], { seed: 1 }),
    });
    const greeting = gateway.sent.find((m) => m.type === "session.instructions.append");
    expect(greeting?.content).toBe(expected.opening);
    const firstCard = cardsFor("geography").find((card) => card.id === expected.cardIds[0]);
    expect(expected.opening).toContain(firstCard!.opening);
    expect(new TextEncoder().encode(expected.opening).length).toBeLessThan(480);
  });

  it("refuses a tutor with no approved cards before using a credit", async () => {
    expect(cardsFor("ppe")).toHaveLength(0);
    const { browser } = await startWith({ tutorId: "ppe" });
    await vi.waitFor(() =>
      expect(browser.events).toContainEqual({
        type: "app.error",
        error: { message: "That tutor is not available yet." },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("consume_interview_credit", expect.anything());
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("refuses an unknown tutor the same way", async () => {
    const { browser } = await startWith({ tutorId: "astrology" });
    await vi.waitFor(() =>
      expect(browser.events).toContainEqual({
        type: "app.error",
        error: { message: "That tutor is not available yet." },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("opens a reading interview on the reading, with cards after it", async () => {
    const reading = READINGS[0]!;
    const { browser, gateway } = await startWith({ readingId: reading.id });
    await vi.waitFor(() => expect(sessionStart(gateway.sent)).toBeDefined());
    const expected = await buildSession({
      tutor: geography,
      cards: selectCards(geography, [], { seed: 1 }),
      reading,
    });
    expect(sessionStart(gateway.sent)!.instructions).toBe(expected.liveInstructions);
    expect(expected.liveInstructions).toContain(reading.context);
    expect(expected.opening).toContain(reading.title);
    expect(new TextEncoder().encode(expected.opening).length).toBeLessThan(480);
    const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(entry["readingId"]).toBe(reading.id);
    expect(browser.events).toContainEqual(
      expect.objectContaining({ type: "app.interview.started", promptHash: expected.promptHash }),
    );
  });

  it("falls back to every approved card when the strand has none", async () => {
    const { gateway } = await startWith({ strand: "no-such-strand" });
    await vi.waitFor(() => expect(sessionStart(gateway.sent)).toBeDefined());
    const expected = await buildSession({
      tutor: geography,
      cards: selectCards(geography, [], { seed: 1 }),
    });
    expect(sessionStart(gateway.sent)!.instructions).toBe(expected.liveInstructions);
  });
});
