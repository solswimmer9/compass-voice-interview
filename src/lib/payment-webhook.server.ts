import { EventName, verifyWebhook, type PaddleEnv } from "@/lib/paddle.server";
import { offerForPriceId } from "@/lib/offer";

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (typeof userId !== "string" || !userId) {
    console.error("Payment completed without a user ID");
    return;
  }
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const offer = offerForPriceId(priceId);
  if (!offer) {
    console.warn("Skipping payment with an unrecognised price");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("purchases").upsert(
    {
      user_id: userId,
      paddle_transaction_id: data.id,
      paddle_customer_id: data.customerId,
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
  const url = new URL(request.url);
  const requestedEnv = url.searchParams.get("env") || "sandbox";
  if (requestedEnv !== "sandbox" && requestedEnv !== "live") {
    return Response.json({ error: "Invalid environment" }, { status: 400 });
  }
  try {
    const event = await verifyWebhook(request, requestedEnv);
    if (event.eventType === EventName.TransactionCompleted) {
      await handleTransactionCompleted(event.data, requestedEnv);
    } else {
      console.log("Unhandled payment event:", event.eventType);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Payment webhook error:", error);
    return new Response("Webhook error", { status: 400 });
  }
}
