import { createStripeClient, verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { offerForPriceId, SCHOOL_BUNDLE } from "@/lib/offer";

// Credits the purchase once per checkout session. The purchases table keeps its original
// column names (paddle_transaction_id / paddle_customer_id); they now hold Stripe IDs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe event payload, shape checked field by field below
async function fulfilCheckout(session: any, env: StripeEnv) {
  const userId = session.metadata?.userId;
  if (typeof userId !== "string" || !userId) {
    console.error("Payment completed without a user ID");
    return;
  }
  const priceId = session.metadata?.priceId;
  const offer = offerForPriceId(priceId);
  if (!offer) {
    console.warn("Skipping payment with an unrecognised price");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("purchases").upsert(
    {
      user_id: userId,
      paddle_transaction_id: session.id,
      paddle_customer_id:
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
      product_id: offer.productId,
      price_id: priceId,
      status: "completed",
      environment: env,
      interviews_remaining: offer.productId === SCHOOL_BUNDLE.productId ? 0 : offer.interviews,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_transaction_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not record purchase: ${error.message}`);
}

// Refunds and disputes revoke the remaining credits. purchases.paddle_transaction_id holds the
// Checkout Session ID, so the charge's payment intent is mapped back to its session via Stripe.
async function revokeForCharge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe charge or dispute payload, shape checked below
  chargeOrDispute: any,
  env: StripeEnv,
  status: "refunded" | "disputed",
) {
  const paymentIntent =
    typeof chargeOrDispute.payment_intent === "string"
      ? chargeOrDispute.payment_intent
      : chargeOrDispute.payment_intent?.id;
  if (!paymentIntent) {
    console.warn("Refund/dispute event without a payment intent");
    return;
  }
  const sessions = await createStripeClient(env).checkout.sessions.list({
    payment_intent: paymentIntent,
    limit: 1,
  });
  const sessionId = sessions.data[0]?.id;
  if (!sessionId) {
    console.warn("No checkout session found for refunded/disputed payment");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("purchases")
    .update({ interviews_remaining: 0, status, updated_at: new Date().toISOString() })
    .eq("paddle_transaction_id", sessionId)
    .eq("environment", env);
  if (error) throw new Error(`Could not revoke purchase: ${error.message}`);
}

export async function handlePaymentWebhook(request: Request) {
  const env = new URL(request.url).searchParams.get("env");
  if (env !== "sandbox" && env !== "live") {
    return Response.json({ received: true, ignored: "invalid env" });
  }
  try {
    const event = await verifyWebhook(request, env);
    const session = event.data.object;
    if (event.type === "checkout.session.completed") {
      if (session.payment_status !== "unpaid") await fulfilCheckout(session, env);
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await fulfilCheckout(session, env);
    } else if (event.type === "charge.refunded") {
      // Only full refunds revoke access; partial refunds leave the entitlement in place.
      if (
        session.refunded === true ||
        (session.amount_refunded > 0 && session.amount_refunded >= session.amount)
      ) {
        await revokeForCharge(session, env, "refunded");
      }
    } else if (event.type === "charge.dispute.created") {
      await revokeForCharge(session, env, "disputed");
    } else {
      console.log("Unhandled payment event:", event.type);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Payment webhook error:", error);
    return new Response("Webhook error", { status: 400 });
  }
}
