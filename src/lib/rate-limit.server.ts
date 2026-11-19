// Best-effort limits per visitor. Counts live in this server instance's memory, so they reset
// when the instance restarts and are not shared between instances. Enough to stop casual
// overuse of a small launch; a shared store would be needed for strict limits.

type Window = { limit: number; ms: number };
type Result = { ok: true } | { ok: false; retryAfterMinutes: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createRateLimiter(windows: Window[], maxVisitors = 10_000) {
  const hits = new Map<string, number[]>();
  const longest = Math.max(...windows.map((window) => window.ms));

  return function take(key: string, now = Date.now()): Result {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < longest);
    for (const window of windows) {
      const inWindow = recent.filter((time) => now - time < window.ms);
      if (inWindow.length >= window.limit) {
        const oldest = inWindow[0] ?? now;
        const retryMs = window.ms - (now - oldest);
        return { ok: false, retryAfterMinutes: Math.max(1, Math.ceil(retryMs / 60_000)) };
      }
    }
    recent.push(now);
    if (!hits.has(key) && hits.size >= maxVisitors) {
      const first = hits.keys().next().value;
      if (first !== undefined) hits.delete(first);
    }
    hits.set(key, recent);
    return { ok: true };
  };
}

export function visitorKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function limitMessage(what: string, minutes: number) {
  const wait =
    minutes >= 120
      ? `${Math.ceil(minutes / 60)} hours`
      : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `You've reached the limit for ${what}. Please try again in ${wait}.`;
}

// Guests only (anonymous accounts, the free tries before sign-in). A guest can clear their
// browser for a new guest account, so this caps new guest interviews per connection. Signed-in
// accounts are not limited here: a whole class can share one school connection, and their
// credits are already enforced by the database.
export const takeGuestInterview = createRateLimiter([
  { limit: 2, ms: HOUR },
  { limit: 4, ms: DAY },
]);

export const takeFeedback = createRateLimiter([
  { limit: 4, ms: HOUR },
  { limit: 10, ms: DAY },
]);
