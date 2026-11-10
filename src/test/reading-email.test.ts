import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReadingEmail, sendReadingEmail, siteOrigin } from "@/lib/reading-email.server";
import { READINGS, type Reading } from "@/lib/readings";

const reading = READINGS[0]!;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reading email", () => {
  it("includes the article link, context, questions and a link back to the interview", () => {
    const email = buildReadingEmail(reading, "https://compass.example");
    expect(email.subject).toContain(reading.title);
    expect(email.text).toContain(reading.url);
    expect(email.text).toContain(reading.context);
    for (const q of reading.questions) expect(email.text).toContain(q);
    expect(email.html).toContain(`https://compass.example/readings/${reading.id}`);
  });

  it("escapes text so it can't inject HTML", () => {
    const sneaky: Reading = { ...reading, title: '<script>alert("x")</script>' };
    const { html } = buildReadingEmail(sneaky, null);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("only trusts https or localhost origins for the link back", () => {
    expect(siteOrigin(undefined, "https://compass.example")).toBe("https://compass.example");
    expect(siteOrigin(undefined, "http://localhost:8080")).toBe("http://localhost:8080");
    expect(siteOrigin(undefined, "http://evil.example")).toBeNull();
    expect(siteOrigin(undefined, "javascript:alert(1)")).toBeNull();
    expect(siteOrigin("https://configured.example", "https://other.example")).toBe(
      "https://configured.example",
    );
  });

  it("gives a friendly error when email isn't set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      sendReadingEmail({ to: "student@example.com", reading, requestOrigin: null }),
    ).rejects.toThrow("Email isn't set up yet");
  });

  it("sends only to the given student address through Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendReadingEmail({ to: "student@example.com", reading, requestOrigin: null });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body).to).toEqual(["student@example.com"]);
  });
});
