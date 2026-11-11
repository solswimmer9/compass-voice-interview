import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyWebhook = vi.fn();
const sessionsList = vi.fn();
const eqCalls: Array<[string, unknown]> = [];
const update = vi.fn();

vi.mock("@/lib/stripe.server", () => ({
  verifyWebhook,
  createStripeClient: () => ({ checkout: { sessions: { list: sessionsList } } }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      update: (values: unknown) => {
        update(values);
        type Chain = { eq: (col: string, val: unknown) => Chain | Promise<{ error: null }> };
        const chain: Chain = {
          eq: (col: string, val: unknown) => {
            eqCalls.push([col, val]);
            return eqCalls.length % 2 === 0 ? Promise.resolve({ error: null }) : chain;
          },
        };
        return chain;
      },
    }),
  },
}));

const request = () =>
  new Request("https://example.test/api/public/payments/webhook?env=sandbox", { method: "POST", body: "{}" });

describe("payment webhook refunds and disputes", () => {
  beforeEach(() => {
    update.mockReset();
    sessionsList.mockReset();
    eqCalls.length = 0;
    sessionsList.mockResolvedValue({ data: [{ id: "cs_123" }] });
  });

  it("zeroes credits on a full refund", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", refunded: true, amount: 1000, amount_refunded: 1000 } },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    const response = await handlePaymentWebhook(request());
    expect(response.status).toBe(200);
    expect(sessionsList).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ interviews_remaining: 0, status: "refunded" }));
    expect(eqCalls).toContainEqual(["paddle_transaction_id", "cs_123"]);
  });

  it("ignores partial refunds", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", refunded: false, amount: 1000, amount_refunded: 200 } },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(request());
    expect(update).not.toHaveBeenCalled();
  });

  it("zeroes credits when a dispute is opened", async () => {
    verifyWebhook.mockResolvedValue({
      type: "charge.dispute.created",
      data: { object: { payment_intent: "pi_2" } },
    });
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(request());
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ interviews_remaining: 0, status: "disputed" }));
  });
});
