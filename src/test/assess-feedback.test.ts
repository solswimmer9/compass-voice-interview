import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const streamText = vi.fn();
const adminRpc = vi.fn();

vi.mock("@/lib/request-auth.server", () => ({ authenticateRequest }));
vi.mock("../lib/request-auth.server.ts", () => ({ authenticateRequest }));
vi.mock("ai", () => ({ streamText }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: adminRpc } }));

const URL = "https://compass-voice-interview.lovable.app/api/assess";
const INTERVIEW = "00000000-0000-0000-0000-000000000000";
const SCHOOL_IP = "198.51.100.7";

function post(body: unknown, ip = SCHOOL_IP) {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer a.b.c",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });
}

function signIn(id: string, consumed = true) {
  const rpc = vi.fn().mockResolvedValue({ data: consumed, error: null });
  authenticateRequest.mockResolvedValue({
    user: { id, email: `${id}@school.example` },
    supabase: { rpc },
  });
  return rpc;
}

function parts(...items: object[]) {
  return {
    fullStream: (async function* () {
      for (const item of items) yield item;
    })(),
  };
}

let counter = 0;
const uniqueUser = () => `user-${Date.now()}-${counter++}`;

describe("feedback limits and failures", () => {
  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("PREVIEW_TESTER_EMAILS", "tester@example.com");
    authenticateRequest.mockReset();
    streamText.mockReset();
    adminRpc.mockReset();
    adminRpc.mockResolvedValue({ data: true, error: null });
    streamText.mockImplementation(() => parts({ type: "text-delta", text: "## Overall\nGood." }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("limits each student separately, even behind one school address", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const first = uniqueUser();
    signIn(first);
    for (let i = 0; i < 4; i++) {
      const response = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
      expect(response.status).toBe(200);
      await response.text();
    }
    const blocked = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    expect(blocked.status).toBe(429);

    // A classmate on the same network address is not affected.
    signIn(uniqueUser());
    const classmate = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    expect(classmate.status).toBe(200);
    expect(await classmate.text()).toContain("Good.");
  });

  it("does not count requests that were refused before sign-in", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue(null);
    const response = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    expect(response.status).toBe(401);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("gives the feedback back when the model fails before writing anything", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const user = uniqueUser();
    signIn(user);
    streamText.mockImplementation(() => parts({ type: "error", error: { statusCode: 402 } }));
    const response = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("out of credit");
    expect(body.error).toContain("has not been used");
    expect(adminRpc).toHaveBeenCalledWith("release_feedback", {
      p_interview_id: INTERVIEW,
      p_user_id: user,
    });
  });

  it("reports busy errors clearly and copes before release_feedback exists", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn(uniqueUser());
    adminRpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    streamText.mockImplementation(() => parts({ type: "error", error: { statusCode: 429 } }));
    const response = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("busy");
    expect(body.error).toContain("contact us");
    warn.mockRestore();
  });

  it("does not give feedback back after some of it was delivered and the browser left", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn(uniqueUser());
    const controller = new AbortController();
    streamText.mockImplementation(() => ({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "## Overall\n" };
        controller.abort();
        yield { type: "abort" };
      })(),
    }));
    const request = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer a.b.c" },
      body: JSON.stringify({ transcript: "x", interviewId: INTERVIEW }),
      signal: controller.signal,
    });
    const response = await handleAssess(request);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Overall");
    expect(text).not.toContain("[[error]]");
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("marks a mid-stream model failure and gives the feedback back", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    signIn(uniqueUser());
    streamText.mockImplementation(() =>
      parts({ type: "text-delta", text: "## Overall\n" }, { type: "error", error: new Error("x") }),
    );
    const response = await handleAssess(post({ transcript: "x", interviewId: INTERVIEW }));
    const text = await response.text();
    expect(text).toContain("[[error]]The assessment could not be completed.");
    expect(adminRpc).toHaveBeenCalledWith("release_feedback", expect.anything());
  });

  it("never calls release_feedback for testers, who were not charged", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue({
      user: { id: uniqueUser(), email: "tester@example.com" },
      supabase: { rpc: vi.fn() },
    });
    streamText.mockImplementation(() => parts({ type: "error", error: { statusCode: 402 } }));
    const response = await handleAssess(post({ transcript: "x", interviewId: "preview" }));
    expect(response.status).toBe(503);
    expect(adminRpc).not.toHaveBeenCalled();
  });
});
