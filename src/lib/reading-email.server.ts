import process from "node:process";
import { createRateLimiter } from "./rate-limit.server.ts";
import { READING_MINUTES, type Reading } from "./readings.ts";

// Sends a practice reading to the signed-in student's own email via Resend.
// Needs the RESEND_API_KEY secret and, optionally, EMAIL_FROM (a sender on a domain
// verified in Resend) and APP_URL (the published site, used for the link back).

const HOUR = 60 * 60 * 1000;
export const takeReadingEmail = createRateLimiter([
  { limit: 3, ms: HOUR },
  { limit: 10, ms: 24 * HOUR },
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only trust a configured site URL, or an https/localhost origin. */
export function siteOrigin(configured: string | undefined, requestOrigin: string | null) {
  for (const candidate of [configured, requestOrigin]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
    } catch {
      continue;
    }
  }
  return null;
}

export function buildReadingEmail(reading: Reading, origin: string | null) {
  const interviewUrl = origin ? `${origin}/readings/${encodeURIComponent(reading.id)}` : null;
  const subject = `Your practice reading: ${reading.title}`;
  const questions = reading.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#111">
<p style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#666">Practice reading</p>
<h1 style="font-size:22px;margin:4px 0 8px">${escapeHtml(reading.title)}</h1>
<p style="color:#666;margin:0 0 16px">${escapeHtml(reading.source)} · ${escapeHtml(reading.usedIn)}</p>
<p><a href="${escapeHtml(reading.url)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${reading.searchLink ? "Find the article" : "Read the article"}</a></p>
<p>Give yourself ${READING_MINUTES} minutes with it, as you would before a real interview.</p>
<h2 style="font-size:15px;margin:20px 0 4px">Context</h2>
<p>${escapeHtml(reading.context)}</p>
<h2 style="font-size:15px;margin:20px 0 4px">Questions to think about</h2>
<ul>${questions}</ul>
${interviewUrl ? `<p style="margin-top:24px"><a href="${escapeHtml(interviewUrl)}">When you're ready, start your interview with Dr River about this reading</a></p>` : ""}
<p style="font-size:12px;color:#888;margin-top:24px">The article belongs to its publisher and may need a subscription. This practice tool is not affiliated with the University of Oxford or the University of Cambridge.</p>
</div>`;
  const text = [
    subject,
    `${reading.source} · ${reading.usedIn}`,
    "",
    `Article: ${reading.url}`,
    `Give yourself ${READING_MINUTES} minutes with it.`,
    "",
    "Context:",
    reading.context,
    "",
    "Questions to think about:",
    ...reading.questions.map((q) => `- ${q}`),
    ...(interviewUrl ? ["", `Start your interview about this reading: ${interviewUrl}`] : []),
  ].join("\n");
  return { subject, html, text };
}

export async function sendReadingEmail(options: {
  to: string;
  reading: Reading;
  requestOrigin: string | null;
}) {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("Email isn't set up yet. Please try again later.");
  const from = process.env["EMAIL_FROM"] || "Dr River <onboarding@resend.dev>";
  const email = buildReadingEmail(
    options.reading,
    siteOrigin(process.env["APP_URL"], options.requestOrigin),
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [options.to], ...email }),
  });
  if (!response.ok) {
    console.error("Reading email failed", response.status, await response.text().catch(() => ""));
    throw new Error("The email couldn't be sent. Please try again.");
  }
}
