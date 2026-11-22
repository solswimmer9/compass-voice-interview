import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyWebhook = vi.fn();
const sessionsList = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/stripe.server", () => ({
  verifyWebhook,
  createStripeClient: () => ({ checkout: { sessions: { list: sessionsList } } }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

const request = () =>
  new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body: "{}",
  });

describe("payment webhook refunds and disputes", () => {
  beforeEach(() => {
    rpc.mockReset();
    sessionsList.mockReset();
    sessionsList.mockResolvedValue({ data: [{ id: "cs_123" }] });
    rpc.mockResolvedValue({ data: 1, error: null });
  });

  it("revokes the purchase on a full refund", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.refunded",
      data: {
        object: { payment_intent: "pi_1", refunded: true, amount: 1000, amount_refunded: 1000 },
      },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    const response = await handlePaymentWebhook(request());
    expect(response.status).toBe(200);
    expect(sessionsList).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
    expect(rpc).toHaveBeenCalledWith("revoke_purchase", {
      p_session_id: "cs_123",
      p_environment: "sandbox",
      p_status: "refunded",
    });
  });

  it("ignores partial refunds", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.refunded",
      data: {
        object: { payment_intent: "pi_1", refunded: false, amount: 1000, amount_refunded: 200 },
      },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(request());
    expect(rpc).not.toHaveBeenCalled();
  });

  it("revokes the purchase when a dispute is opened", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.dispute.created",
      data: { object: { payment_intent: "pi_2" } },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(request());
    expect(rpc).toHaveBeenCalledWith(
      "revoke_purchase",
      expect.objectContaining({ p_status: "disputed" }),
    );
  });

  it("still records a refund that arrives before the purchase (nothing to update yet)", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    verifyWebhook.mockResolvedValue({
      type: "charge.refunded",
      data: {
        object: { payment_intent: "pi_3", refunded: true, amount: 2000, amount_refunded: 2000 },
      },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    const response = await handlePaymentWebhook(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "revoke_purchase",
      expect.objectContaining({ p_session_id: "cs_123" }),
    );
  });

  it("asks Stripe to retry when the revocation cannot be saved", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    verifyWebhook.mockResolvedValue({
      type: "charge.dispute.created",
      data: { object: { payment_intent: "pi_4" } },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    const response = await handlePaymentWebhook(request());
    expect(response.status).toBe(400);
  });
});
