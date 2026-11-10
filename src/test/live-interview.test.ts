import { beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.unstubAllEnvs();
  });

  it("makes signed-in non-testers use their interview credits", async () => {
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "someone-else@example.com");
    const browser = browserSocket();
    bindLiveConnection(browser.socket, config, executionContext(), mocks.connect);

    browser.start();

    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("consume_interview_credit", expect.anything()),
    );
    vi.unstubAllEnvs();
  });
});
