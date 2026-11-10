import { createFileRoute } from "@tanstack/react-router";
import { handlePaymentWebhook } from "@/lib/payment-webhook.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handlePaymentWebhook(request),
    },
  },
});
