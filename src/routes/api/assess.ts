import { createFileRoute } from "@tanstack/react-router";
import { handleAssess } from "@/lib/assess.server";

export const Route = createFileRoute("/api/assess")({
  server: { handlers: { POST: ({ request }) => handleAssess(request) } },
});
