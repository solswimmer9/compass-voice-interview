import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const streamText = vi.fn();

vi.mock("@/lib/request-auth.server", () => ({ authenticateRequest }));
vi.mock("../lib/request-auth.server.ts", () => ({ authenticateRequest }));
vi.mock("ai", () => ({ streamText }));

const PUBLISHED_URL = "https://compass-voice-interview.lovable.app/api/assess";
// The kind of internal address the published server may see for itself.
const INTERNAL_URL =
  "https://live--6db3f9e0-08e4-5430-979a-8856445f33a9.abc.lovable.app/api/assess";

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
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
    authenticateRequest.mockReset();
    streamText.mockReset();
    streamText.mockReturnValue({ fullStream: (async function* () {})() });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses feedback with no sign-in, whatever the address", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue(null);
    for (const url of [PUBLISHED_URL, INTERNAL_URL, "http://localhost:8080/api/assess"]) {
      const response = await handleAssess(post(url, { transcript: "x", interviewId: "preview" }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(streamText).not.toHaveBeenCalled();
    }
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
        INTERNAL_URL,
        { transcript: "x", interviewId: "00000000-0000-0000-0000-000000000000" },
        "a.b.c",
      ),
    );
    expect(rpc).toHaveBeenCalledWith("consume_feedback", expect.anything());
    expect(response.status).toBe(403);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("lets a listed tester run unlimited preview feedback", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn();
    authenticateRequest.mockResolvedValue({
      user: { email: "tester@example.com" },
      supabase: { rpc },
    });
    const response = await handleAssess(
      post(PUBLISHED_URL, { transcript: "x", interviewId: "preview" }, "a.b.c"),
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
  });

  it("refuses PPE trial feedback for a non-tester before any allowance is used", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn();
    authenticateRequest.mockResolvedValue({
      user: { email: "student@example.com" },
      supabase: { rpc },
    });
    const response = await handleAssess(
      post(
        PUBLISHED_URL,
        {
          transcript: "x",
          interviewId: "00000000-0000-0000-0000-000000000000",
          tutorId: "ppe",
        },
        "a.b.c",
      ),
    );
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("gives a tester PPE feedback from Prof Matt's notes", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue({
      user: { email: "tester@example.com" },
      supabase: { rpc: vi.fn() },
    });
    const response = await handleAssess(
      post(
        PUBLISHED_URL,
        { transcript: "x", interviewId: "preview", tutorId: "ppe", cardIds: ["bag-charge"] },
        "a.b.c",
      ),
    );
    expect(response.status).toBe(200);
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("Oxford PPE admissions tutor");
    expect(system).toContain("[bag-charge]");
    expect(system).not.toContain("[rent-cap-day-after]");
  });
});
