import { createFileRoute } from "@tanstack/react-router";
import { handleElevenLabsToken } from "@/lib/elevenlabs-interview.server";

export const Route = createFileRoute("/api/elevenlabs/token")({
  server: { handlers: { POST: ({ request }) => handleElevenLabsToken(request) } },
});
