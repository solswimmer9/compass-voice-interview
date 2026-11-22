import posthog from "posthog-js";

// Public PostHog project key (safe in browser code). Empty means analytics is off.
const POSTHOG_KEY = "";
const POSTHOG_HOST = "https://eu.i.posthog.com";

let started = false;

/** Browser only. Memory persistence sets no cookies or storage, so no consent banner is needed. */
export function initAnalytics() {
  if (started || !POSTHOG_KEY || typeof window === "undefined") return;
  started = true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: "memory",
    person_profiles: "never",
    capture_pageview: "history_change",
    disable_session_recording: true,
    mask_all_text: true,
  });
}

/** Funnel events only: never pass names, emails or anything the student said. */
export function track(event: string, properties?: Record<string, string | number | boolean>) {
  if (started) posthog.capture(event, properties);
}
