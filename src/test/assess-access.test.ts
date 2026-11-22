import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();
const streamText = vi.fn();
const adminEq = vi.fn();
const adminUpdate = vi.fn();
// The checked feedback path's calls. Rejecting sends every student and tester request on to the
// single-call path these tests check, after recording what the analyst would have been given.
const generateText = vi.fn();

// The real charts are approved. These tests keep checking the draft rule (students never get a
// draft object; testers do) by treating both charts as drafts in this file only.
vi.mock("@/content/objects/uk-turnout", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, unknown> };
  return { default: { ...real.default, status: "draft", reviewedBy: "", reviewedAt: "" } };
});
vi.mock("@/content/objects/urban-rural-share", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, unknown> };
  return { default: { ...real.default, status: "draft", reviewedBy: "", reviewedAt: "" } };
});

vi.mock("@/lib/request-auth.server", () => ({ authenticateRequest }));
vi.mock("../lib/request-auth.server.ts", () => ({ authenticateRequest }));
vi.mock("ai", () => ({ streamText, generateText }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ update: adminUpdate }) },
}));

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
    adminEq.mockReset();
    adminUpdate.mockReset();
    const chain = { eq: adminEq, error: null };
    adminEq.mockReturnValue(chain);
    adminUpdate.mockReturnValue(chain);
    generateText.mockReset();
    generateText.mockRejectedValue(new Error("checked path unavailable in this file"));
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

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

  it("refuses an unsupported video format before using a feedback", async () => {
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
          video: "AAAA",
          videoType: "video/x-evil",
          interviewId: "00000000-0000-0000-0000-000000000000",
        },
        "a.b.c",
      ),
    );
    expect(response.status).toBe(415);
    expect(rpc).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("refuses an oversized request before reading it", async () => {
    const { handleAssess, MAX_REQUEST_BYTES } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue({
      user: { email: "student@example.com" },
      supabase: { rpc: vi.fn() },
    });
    const request = new Request(PUBLISHED_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_REQUEST_BYTES + 1),
      },
      body: "{}",
    });
    const response = await handleAssess(request);
    expect(response.status).toBe(413);
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

  it("checks the feedback allowance for a student's PPE interview and uses approved notes only", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticateRequest.mockResolvedValue({
      user: { email: "student-ppe@example.com" },
      supabase: { rpc },
    });
    const request = post(
      PUBLISHED_URL,
      {
        transcript: "x",
        interviewId: "00000000-0000-0000-0000-000000000000",
        tutorId: "ppe",
        cardIds: ["prepunishment", "promise-to-the-dead"],
      },
      "a.b.c",
    );
    // Its own visitor, so the in-memory feedback rate limit from earlier tests does not apply.
    request.headers.set("x-forwarded-for", "203.0.113.77");
    const response = await handleAssess(request);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_feedback", expect.anything());
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("Oxford PPE admissions tutor");
    expect(system).toContain("[prepunishment]");
    // promise-to-the-dead is a draft: a student's feedback never draws on draft notes.
    expect(system).not.toContain("[promise-to-the-dead]");
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
        {
          transcript: "x",
          interviewId: "preview",
          tutorId: "ppe",
          cardIds: ["promise-to-the-dead"],
        },
        "a.b.c",
      ),
    );
    expect(response.status).toBe(200);
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("Oxford PPE admissions tutor");
    expect(system).toContain("[promise-to-the-dead]");
    expect(system).not.toContain("[rent-cap-day-after]");
  });

  it("keeps a draft object's notes out of a student's feedback", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticateRequest.mockResolvedValue({
      user: { email: "student-object@example.com" },
      supabase: { rpc },
    });
    const request = post(
      PUBLISHED_URL,
      {
        transcript: "x",
        interviewId: "00000000-0000-0000-0000-000000000000",
        objectId: "geo-chart-a",
      },
      "a.b.c",
    );
    request.headers.set("x-forwarded-for", "203.0.113.78");
    const response = await handleAssess(request);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_feedback", expect.anything());
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).not.toContain("OBJECT INTERVIEW NOTES");
  });

  it("keeps a draft object's notes out of a student's checked feedback, but not a tester's", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const transcript = [
      "Dr River: What could this chart show?",
      "You: Maybe the share of people living in towns over time.",
      "Dr River: Why do you say that?",
      "You: Because the line rises steadily, like urbanisation usually does.",
    ].join("\n\n");
    const analystPrompts = () =>
      (generateText.mock.calls as [{ prompt: string }][]).map(([args]) => args.prompt);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticateRequest.mockResolvedValue({
      user: { email: "student-object-checked@example.com" },
      supabase: { rpc },
    });
    const student = post(
      PUBLISHED_URL,
      { transcript, interviewId: "00000000-0000-0000-0000-000000000000", objectId: "geo-chart-a" },
      "a.b.c",
    );
    student.headers.set("x-forwarded-for", "203.0.113.79");
    await (await handleAssess(student)).text();
    expect(analystPrompts().length).toBeGreaterThan(0);
    for (const prompt of analystPrompts()) expect(prompt).not.toContain("OBJECT INTERVIEW NOTES");
    generateText.mockClear();
    authenticateRequest.mockResolvedValue({
      user: { email: "tester@example.com" },
      supabase: { rpc: vi.fn() },
    });
    await (
      await handleAssess(
        post(
          PUBLISHED_URL,
          { transcript, interviewId: "preview", objectId: "geo-chart-a" },
          "a.b.c",
        ),
      )
    ).text();
    expect(analystPrompts().some((prompt) => prompt.includes("OBJECT INTERVIEW NOTES"))).toBe(true);
  });

  it("gives a tester feedback from the draft object's notes, for the matching tutor only", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    authenticateRequest.mockResolvedValue({
      user: { email: "tester@example.com" },
      supabase: { rpc: vi.fn() },
    });
    await handleAssess(
      post(
        PUBLISHED_URL,
        { transcript: "x", interviewId: "preview", tutorId: "ppe", objectId: "ppe-chart-a" },
        "a.b.c",
      ),
    );
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("OBJECT INTERVIEW NOTES");
    await handleAssess(
      post(
        PUBLISHED_URL,
        { transcript: "x", interviewId: "preview", objectId: "ppe-chart-a" },
        "a.b.c",
      ),
    );
    const { system: geography } = streamText.mock.calls[1]![0] as { system: string };
    expect(geography).not.toContain("OBJECT INTERVIEW NOTES");
  });

  it("charges a student's multi-turn transcript once, then falls back to single-call feedback if the checked path fails", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authenticateRequest.mockResolvedValue({
      user: { email: "student-multi@example.com" },
      supabase: { rpc },
    });
    const transcript = [
      "Dr River: Why do cities exist where they do?",
      "You: I think rivers gave early towns water and a way to trade.",
      "Dr River: Does that still matter?",
      "You: Less now, because railways and roads changed which places were easy to reach.",
    ].join("\n\n");
    const request = post(
      PUBLISHED_URL,
      { transcript, interviewId: "00000000-0000-0000-0000-000000000000" },
      "a.b.c",
    );
    request.headers.set("x-forwarded-for", "203.0.113.78");
    const response = await handleAssess(request);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    // The checked path runs first for everyone; generateText rejects here, so it fails and the
    // student silently gets the single-call feedback, still charged only once.
    await response.text();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(streamText).toHaveBeenCalledTimes(1);
    const { system } = streamText.mock.calls[0]![0] as { system: string };
    expect(system).toContain("Cambridge geography admissions tutor");
  });

  describe("a failed letter gives the feedback back", () => {
    const interviewId = "00000000-0000-0000-0000-000000000000";
    let visitor = 0;
    async function requestLetter(parts: { type: string; text?: string; error?: unknown }[]) {
      const { handleAssess } = await import("@/lib/assess.server");
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield* parts;
        })(),
      });
      authenticateRequest.mockResolvedValue({
        user: { id: "student-id", email: "student@example.com" },
        supabase: { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) },
      });
      const request = post(PUBLISHED_URL, { transcript: "x", interviewId }, "a.b.c");
      // Its own visitor, so the feedback rate limit shared by this file never applies.
      request.headers.set("cf-connecting-ip", `198.51.100.${++visitor}`);
      const response = await handleAssess(request);
      return response.text();
    }

    it("restores the allowance when the model fails", async () => {
      const text = await requestLetter([{ type: "error", error: { statusCode: 500 } }]);
      expect(text).toContain("[[error]]");
      expect(adminUpdate).toHaveBeenCalledWith({ feedback_used: false });
      expect(adminEq).toHaveBeenCalledWith("id", interviewId);
      expect(adminEq).toHaveBeenCalledWith("user_id", "student-id");
    });

    it("restores the allowance when the checked letter and its fallback both fail", async () => {
      const { handleAssess } = await import("@/lib/assess.server");
      streamText.mockReturnValue({
        fullStream: (async function* () {
          yield { type: "error", error: { statusCode: 500 } };
        })(),
      });
      authenticateRequest.mockResolvedValue({
        user: { id: "student-id", email: "student@example.com" },
        supabase: { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) },
      });
      const transcript = [
        "Dr River: Who owns the outdoors?",
        "You: I think the person who pays for the land.",
        "Dr River: Why?",
        "You: Well, because they bought it.",
      ].join("\n\n");
      const request = post(PUBLISHED_URL, { transcript, interviewId }, "a.b.c");
      request.headers.set("cf-connecting-ip", `198.51.100.${++visitor}`);
      const text = await (await handleAssess(request)).text();
      expect(generateText).toHaveBeenCalled();
      expect(text).toContain("[[error]]");
      expect(adminUpdate).toHaveBeenCalledWith({ feedback_used: false });
    });

    it("keeps the allowance used once a letter is delivered, and saves the letter", async () => {
      const text = await requestLetter([{ type: "text-delta", text: "Dear student," }]);
      expect(text).toContain("Dear student,");
      expect(adminUpdate).not.toHaveBeenCalledWith({ feedback_used: false });
      expect(adminUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: "Dear student,", finished_at: expect.any(String) }),
      );
    });
  });

  it("limits feedback per student, not per school connection", async () => {
    const { handleAssess } = await import("@/lib/assess.server");
    const ask = async (studentId: string) => {
      authenticateRequest.mockResolvedValue({
        user: { id: studentId, email: `${studentId}@example.com` },
        supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) },
      });
      const request = post(
        PUBLISHED_URL,
        { transcript: "x", interviewId: "00000000-0000-0000-0000-000000000000" },
        "a.b.c",
      );
      request.headers.set("cf-connecting-ip", "192.0.2.50");
      return (await handleAssess(request)).status;
    };
    // Thirty students behind one address are each let through to their allowance check.
    for (let index = 0; index < 30; index++) expect(await ask(`class-${index}`)).toBe(403);
    // One student asking again and again is still limited.
    const statuses = [];
    for (let index = 0; index < 5; index++) statuses.push(await ask("busy-student"));
    expect(statuses.at(-1)).toBe(429);
  });
});
