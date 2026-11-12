import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    start() {
      onMessage?.(
        JSON.stringify({
          type: "app.start",
          sdp: "test-offer",
          openingTurn: 1,
          accessToken: "valid-access-token",
          environment: "live",
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
    expect(browser.events).toContainEqual({ type: "app.interview.started", interviewId });
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
    expect(browser.events).toContainEqual({
      type: "app.interview.started",
      interviewId: "preview",
    });
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

describe("PPE interviews", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({
      user: { email: "owner@example.com" },
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockResolvedValue({ data: { allowed: true, interviewId }, error: null });
    mocks.connect.mockRejectedValue(new Error("Voice startup failed for this test"));
  });

  function startPpe(_browser: ReturnType<typeof browserSocket>, extra: object = {}) {
    return JSON.stringify({
      type: "app.start",
      sdp: "test-offer",
      openingTurn: 2,
      accessToken: "valid-access-token",
      environment: "live",
      tutorId: "ppe",
      ...extra,
    });
  }

  function bound() {
    let handler: ((data: unknown) => void) | undefined;
    const browser = browserSocket();
    const socket: LiveSocket = {
      ...browser.socket,
      onMessage(h) {
        handler = h;
      },
    };
    bindLiveConnection(socket, config, executionContext(), mocks.connect);
    return { browser, send: (data: string) => handler?.(data) };
  }

  function gateway(sent: Array<Record<string, unknown>>): LiveSocket {
    return {
      readyState: 1,
      send(data: string) {
        sent.push(JSON.parse(data) as Record<string, unknown>);
      },
      close: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    };
  }

  it("makes a signed-in non-tester use one credit and hear approved PPE cards only", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "someone-else@example.com");
    const sent: Array<Record<string, unknown>> = [];
    mocks.connect.mockResolvedValue(gateway(sent));
    const { ppeTutor } = await import("@/lib/ppe.server");
    const approved = new Set(
      ppeTutor()
        .cards.filter((card) => card.status === "approved")
        .map((card) => card.id),
    );
    for (let turn = 0; turn < 12; turn++) {
      vi.clearAllMocks();
      mocks.rpc.mockResolvedValue({ data: { allowed: true, interviewId }, error: null });
      sent.length = 0;
      const { browser, send } = bound();

      send(startPpe(browser, { openingTurn: turn }));

      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", {
        p_environment: "live",
      });
      const started = browser.events.find((event) => event["type"] === "app.interview.started");
      expect(started).toMatchObject({ interviewId, tutorId: "ppe" });
      for (const id of started?.["cardIds"] as string[]) expect(approved.has(id), id).toBe(true);
      const session = sent[0]?.["session"] as { instructions: string };
      expect(session.instructions).toContain("You are Prof Matt");
      expect(session).toMatchObject({ audio: { output: { voice: "stone" } } });
    }
  });

  it("does not start PPE for a student whose credits are used up", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "someone-else@example.com");
    mocks.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    const { browser, send } = bound();

    send(startPpe(browser));

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(
        expect.objectContaining({
          type: "app.error",
          error: { message: expect.stringMatching(/free interview has been used/) },
        }),
      ),
    );
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("refuses PPE without sign-in", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    mocks.authenticate.mockResolvedValue(null);
    const { browser, send } = bound();

    send(startPpe(browser));

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(expect.objectContaining({ type: "app.error" })),
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses an unknown tutor without touching credits", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const { browser, send } = bound();

    send(startPpe(browser, { tutorId: "history" }));

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(expect.objectContaining({ type: "app.error" })),
    );
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("starts Prof Matt for a tester with no credit use", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const sent: Array<Record<string, unknown>> = [];
    mocks.connect.mockResolvedValue(gateway(sent));
    const { browser, send } = bound();

    send(startPpe(browser));

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(mocks.rpc).not.toHaveBeenCalled();
    const started = browser.events.find((event) => event["type"] === "app.interview.started");
    expect(started).toMatchObject({ interviewId: "preview", tutorId: "ppe" });
    expect(started?.["cardIds"]).toHaveLength(3);
    const session = sent[0]?.["session"] as { instructions: string };
    expect(session.instructions).toContain("You are Prof Matt");
    expect(session.instructions).not.toContain("Dr River");
    expect(session).toMatchObject({ audio: { output: { voice: "stone" } } });
  });

  it("keeps geography on the original Dr River prompt", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const sent: Array<Record<string, unknown>> = [];
    mocks.connect.mockResolvedValue(gateway(sent));
    const { browser, send } = bound();

    send(startPpe(browser, { tutorId: undefined }));

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const session = sent[0]?.["session"] as { instructions: string };
    expect(session.instructions).toContain("Dr River");
    expect(session.instructions).not.toContain("Prof Matt");
    expect(session).toMatchObject({ audio: { output: { voice: "vesper" } } });
  });
});

describe("Dr River on topic cards (testers only)", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.authenticate.mockResolvedValue({
      user: { email: "owner@example.com" },
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockResolvedValue({ data: { allowed: true, interviewId }, error: null });
  });

  async function instructionsFor(testers: string) {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", testers);
    const sent: Array<Record<string, unknown>> = [];
    mocks.connect.mockResolvedValue({
      readyState: 1,
      send: (data: string) => void sent.push(JSON.parse(data) as Record<string, unknown>),
      close: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    } satisfies LiveSocket);
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);
    browser.start();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    return (sent[0]?.["session"] as { instructions: string }).instructions;
  }

  it("gives a tester approved geography cards and a student the fixed prompt", async () => {
    const { buildGeographySession } = await import("@/lib/geography.server");
    const { NOTES_CONTEXT } = await import("@/lib/interview-briefing");
    const expected = await buildGeographySession({ openingTurn: 1 });

    const tester = await instructionsFor("owner@example.com");
    expect(tester).toBe(expected.liveInstructions);
    expect(tester).toContain("YOUR THEMES FOR THIS INTERVIEW");
    expect(tester).not.toContain(NOTES_CONTEXT);
    expect(mocks.rpc).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { allowed: true, interviewId }, error: null });
    const student = await instructionsFor("someone-else@example.com");
    expect(student).toContain(NOTES_CONTEXT);
    expect(student).not.toContain("YOUR THEMES FOR THIS INTERVIEW");
    expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", { p_environment: "live" });
  });
});
