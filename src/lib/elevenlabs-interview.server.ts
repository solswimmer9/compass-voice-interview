import process from "node:process";
import { openingQuestion } from "./interview-briefing.ts";

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

export async function createElevenLabsSession(openingTurn: number) {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs is not connected. Connect it in the project settings.");
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
    { headers: { "xi-api-key": key } },
  );
  if (!response.ok) {
    const detail = errorMessage(await response.text());
    console.error(`ElevenLabs token request failed [${response.status}]: ${detail}`);
    throw new Error(`ElevenLabs could not start the interview [${response.status}]: ${detail}`);
  }
  const data = (await response.json()) as { signed_url?: unknown };
  if (typeof data.signed_url !== "string" || !data.signed_url) {
    throw new Error("ElevenLabs returned an invalid voice connection.");
  }
  return { signedUrl: data.signed_url, openingQuestion: openingQuestion(openingTurn) };
}
