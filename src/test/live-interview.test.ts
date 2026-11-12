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
  });
});

describe("Object interviews", () => {
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

  function startObject(extra: object = {}) {
    return JSON.stringify({
      type: "app.start",
      sdp: "test-offer",
      openingTurn: 1,
      accessToken: "valid-access-token",
      environment: "live",
      mode: "object",
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

  for (const tutorId of [undefined, "ppe"] as const) {
    const who = tutorId ?? "geography";

    it(`refuses a student a draft ${who} object before any credit is spent`, async () => {
      vi.stubEnv("PREVIEW_TESTER_EMAILS", "someone-else@example.com");
      const { browser, send } = bound();

      send(startObject({ tutorId }));

      await vi.waitFor(() =>
        expect(browser.events).toContainEqual(
          expect.objectContaining({
            type: "app.error",
            error: { message: expect.stringMatching(/no object interview/) },
          }),
        ),
      );
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(browser.events.some((e) => e["type"] === "app.interview.object")).toBe(false);
      expect(browser.events.some((e) => e["type"] === "app.interview.started")).toBe(false);
    });

    it(`gives a tester the draft ${who} object, keeping the tutor's notes off the browser`, async () => {
      vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
      const sent: Array<Record<string, unknown>> = [];
      mocks.connect.mockResolvedValue(gateway(sent));
      const { selectObject } = await import("@/content/objects");
      const object = selectObject(who, { includeDrafts: true, seed: 1 })!;
      expect(object.status).toBe("draft");
      const { browser, send } = bound();

      send(startObject({ tutorId }));

      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(browser.events).toContainEqual(
        expect.objectContaining({ type: "app.interview.started", objectId: object.id }),
      );
      const shown = browser.events.find((e) => e["type"] === "app.interview.object");
      expect(shown).toEqual({
        type: "app.interview.object",
        objectId: object.id,
        svg: object.svg,
        alt: object.alt,
        caption: `${who === "ppe" ? "Prof Matt" : "Dr River"} has put this on the table`,
      });
      const toBrowser = JSON.stringify(browser.events);
      expect(toBrowser).not.toContain(object.title);
      expect(toBrowser).not.toContain(object.notes.shows);
      expect(toBrowser).not.toContain(object.notes.opening);
      expect(toBrowser).not.toContain(object.notes.goodReasoning);
      for (const probe of object.notes.probes) expect(toBrowser).not.toContain(probe);
      const session = sent[0]?.["session"] as { instructions: string };
      expect(session.instructions).toContain("OBJECT INTERVIEW");
      expect(session.instructions).toContain(object.notes.shows);
      expect(session.instructions).toContain(who === "ppe" ? "You are Prof Matt" : "Dr River");
    });
  }

  it("refuses an unknown interview mode without touching sign-in or credits", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const { browser, send } = bound();

    send(startObject({ mode: "free-for-all" }));

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(expect.objectContaining({ type: "app.error" })),
    );
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("still refuses an object interview without sign-in", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    mocks.authenticate.mockResolvedValue(null);
    const { browser, send } = bound();

    send(startObject());

    await vi.waitFor(() =>
      expect(browser.events).toContainEqual(expect.objectContaining({ type: "app.error" })),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(browser.events.some((e) => e["type"] === "app.interview.object")).toBe(false);
  });

  it("puts nothing on the table in a normal interview", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "owner@example.com");
    const sent: Array<Record<string, unknown>> = [];
    mocks.connect.mockResolvedValue(gateway(sent));
    const { browser, send } = bound();

    send(startObject({ mode: undefined }));

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(browser.events.some((e) => e["type"] === "app.interview.object")).toBe(false);
    const session = sent[0]?.["session"] as { instructions: string };
    expect(session.instructions).not.toContain("OBJECT INTERVIEW");
  });
});
