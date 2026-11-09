import { describe, expect, it } from "vitest";

import { createRateLimiter, limitMessage, visitorKey } from "@/lib/rate-limit.server";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("rate limiter", () => {
  it("allows up to the hourly limit, then blocks", () => {
    const take = createRateLimiter([{ limit: 3, ms: HOUR }]);
    expect(take("a", 0).ok).toBe(true);
    expect(take("a", MINUTE).ok).toBe(true);
    expect(take("a", 2 * MINUTE).ok).toBe(true);
    expect(take("a", 3 * MINUTE)).toEqual({ ok: false, retryAfterMinutes: 57 });
  });

  it("allows again once the window has passed", () => {
    const take = createRateLimiter([{ limit: 1, ms: HOUR }]);
    expect(take("a", 0).ok).toBe(true);
    expect(take("a", HOUR - 1).ok).toBe(false);
    expect(take("a", HOUR).ok).toBe(true);
  });

  it("keeps visitors separate", () => {
    const take = createRateLimiter([{ limit: 1, ms: HOUR }]);
    expect(take("a", 0).ok).toBe(true);
    expect(take("b", 0).ok).toBe(true);
    expect(take("a", 0).ok).toBe(false);
  });

  it("applies the daily limit even when each hour is fine", () => {
    const take = createRateLimiter([
      { limit: 3, ms: HOUR },
      { limit: 4, ms: 24 * HOUR },
    ]);
    for (let i = 0; i < 4; i++) expect(take("a", i * 2 * HOUR).ok).toBe(true);
    expect(take("a", 8 * HOUR).ok).toBe(false);
  });

  it("does not count blocked attempts", () => {
    const take = createRateLimiter([{ limit: 1, ms: HOUR }]);
    take("a", 0);
    take("a", 10 * MINUTE);
    expect(take("a", HOUR).ok).toBe(true);
  });

  it("identifies visitors by their address", () => {
    const request = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "203.0.113.5" },
    });
    expect(visitorKey(request)).toBe("203.0.113.5");
  });

  it("writes readable messages", () => {
    expect(limitMessage("interviews", 1)).toContain("1 minute.");
    expect(limitMessage("interviews", 300)).toContain("5 hours");
  });
});
