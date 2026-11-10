import process from "node:process";
import { openingMessage } from "./interview-briefing.ts";
import { limitMessage, takeInterview, visitorKey } from "./rate-limit.server.ts";

const ELEVENLABS_AGENT_ID = "agent_3401m72r88s7fjkbdn23rd2bpds9";

function errorMessage(body: string) {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown };
    for (const value of [parsed.detail, parsed.message]) {
      if (typeof value === "string") return value.slice(0, 300);
      if (value && typeof value === "object" && "message" in value) {
        const message = (value as { message?: unknown }).message;
        if (typeof message === "string") return message.slice(0, 300);
      }
    }
  } catch {
    // The provider sometimes returns plain text; a short excerpt is safe to show.
  }
  return body.replace(/[\r\n]+/g, " ").slice(0, 300);
}

export async function handleElevenLabsToken(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Voice request origin rejected" }, { status: 403 });
  }

  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) {
    return Response.json(
      { error: "ElevenLabs is not connected. Connect it in the project settings." },
      { status: 503 },
    );
  }

  const allowed = takeInterview(visitorKey(request));
  if (!allowed.ok) {
    return Response.json(
      { error: limitMessage("interviews", allowed.retryAfterMinutes) },
      { status: 429 },
    );
  }

  let body: { openingTurn?: unknown } = {};
  try {
    body = (await request.json()) as { openingTurn?: unknown };
  } catch {
    return Response.json({ error: "Invalid interview request" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": key }, signal: request.signal },
    );
    if (!response.ok) {
      const detail = errorMessage(await response.text());
      console.error(`ElevenLabs token request failed [${response.status}]: ${detail}`);
      return Response.json(
        { error: `ElevenLabs could not start the interview [${response.status}]: ${detail}` },
        { status: response.status, headers: { "cache-control": "no-store" } },
      );
    }
    const data = (await response.json()) as { signed_url?: unknown };
    if (typeof data.signed_url !== "string" || !data.signed_url) {
      return Response.json(
        { error: "ElevenLabs returned an invalid voice connection." },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      { signedUrl: data.signed_url, firstMessage: openingMessage(body.openingTurn) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("ElevenLabs token request failed", error);
    return Response.json(
      { error: "ElevenLabs could not be reached. Please try again." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
