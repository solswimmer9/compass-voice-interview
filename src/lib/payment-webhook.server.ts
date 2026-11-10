import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { offerForPriceId } from "@/lib/offer";

// Credits the purchase once per checkout session. The purchases table keeps its original
// column names (paddle_transaction_id / paddle_customer_id); they now hold Stripe IDs.
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
      paddle_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      product_id: offer.productId,
      price_id: priceId,
      status: "completed",
      environment: env,
      interviews_remaining: offer.interviews,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_transaction_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not record purchase: ${error.message}`);
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
    } else {
      console.log("Unhandled payment event:", event.type);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Payment webhook error:", error);
    return new Response("Webhook error", { status: 400 });
  }
}
