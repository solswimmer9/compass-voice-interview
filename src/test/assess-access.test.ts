import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const streamText = vi.fn();

vi.mock("@/lib/request-auth.server", () => ({ authenticateRequest }));
vi.mock("../lib/request-auth.server.ts", () => ({ authenticateRequest }));
vi.mock("ai", () => ({ streamText }));

const PUBLISHED_URL = "https://compass-voice-interview.lovable.app/api/assess";
function post(url: string, body: unknown, token?: string) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("feedback access", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    authenticateRequest.mockReset();
    streamText.mockReset();
    streamText.mockReturnValue({ fullStream: (async function* () {})() });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses feedback with no sign-in on the published site", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue(null);
    const response = await handleAssess(
      post(PUBLISHED_URL, { transcript: "x", interviewId: "preview" }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("checks the allowance for a normal signed-in user", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    authenticateRequest.mockResolvedValue({
      user: { email: "student@example.com" },
      supabase: { rpc },
    });
    const response = await handleAssess(
      post(
        PUBLISHED_URL,
        { transcript: "x", interviewId: "00000000-0000-0000-0000-000000000000" },
        "a.b.c",
      ),
    );
    expect(rpc).toHaveBeenCalledWith("consume_feedback", expect.anything());
    expect(response.status).toBe(403);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("lets a signed-out visitor run unlimited preview feedback", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const response = await handleAssess(
      post("http://localhost:8080/api/assess", { transcript: "x", interviewId: "preview" }),
    );
    expect(response.status).toBe(200);
    expect(authenticateRequest).not.toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
  });
});
