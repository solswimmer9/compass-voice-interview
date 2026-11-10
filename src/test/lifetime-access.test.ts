import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERVIEW_PACK, LIFETIME_ACCESS, offerForPriceId } from "@/lib/offer";

const upsert = vi.fn();
const verifyWebhook = vi.fn();

vi.mock("@/lib/paddle.server", () => ({
  EventName: { TransactionCompleted: "transaction.completed" },
  verifyWebhook,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ upsert }) },
}));

function completedPayment(priceId: string) {
  verifyWebhook.mockResolvedValue({
    eventType: "transaction.completed",
    data: {
      id: "txn_123",
      customerId: "ctm_123",
      customData: { userId: "user-1" },
      items: [{ price: { importMeta: { externalId: priceId } } }],
    },
  });
  return new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    body: "{}",
  });
}

describe("lifetime access offer", () => {
  it("is a one-off £100 payment", () => {
    expect(LIFETIME_ACCESS.amountMinor).toBe(10000);
    expect(LIFETIME_ACCESS.currency).toBe("gbp");
    expect(LIFETIME_ACCESS.displayPrice).toBe("£100");
    expect("recurringInterval" in LIFETIME_ACCESS).toBe(false);
  });

  it("is recognised by price ID alongside the pack, and nothing else is", () => {
    expect(offerForPriceId(LIFETIME_ACCESS.priceId)).toBe(LIFETIME_ACCESS);
    expect(offerForPriceId(INTERVIEW_PACK.priceId)).toBe(INTERVIEW_PACK);
    expect(offerForPriceId("something_else")).toBeUndefined();
  });
});

describe("payment webhook", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });

  it("records a lifetime purchase with lifetime credits, once per transaction", async () => {
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    const response = await handlePaymentWebhook(completedPayment(LIFETIME_ACCESS.priceId));
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        product_id: LIFETIME_ACCESS.productId,
        interviews_remaining: LIFETIME_ACCESS.interviews,
      }),
      { onConflict: "paddle_transaction_id", ignoreDuplicates: true },
    );
  });

  it("still records the 2-Interview Pack with two credits", async () => {
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(completedPayment(INTERVIEW_PACK.priceId));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: INTERVIEW_PACK.productId, interviews_remaining: 2 }),
      expect.anything(),
    );
  });

  it("ignores payments for unknown prices", async () => {
    const { handlePaymentWebhook } = await import("@/lib/payment-webhook.server");
    await handlePaymentWebhook(completedPayment("unknown_price"));
    expect(upsert).not.toHaveBeenCalled();
  });
});
