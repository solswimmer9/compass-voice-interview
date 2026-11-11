import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The purchases table stores the Stripe Checkout Session ID in paddle_transaction_id.
export const confirmCheckoutSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]+$/).max(255),
      environment: z.enum(["sandbox", "live"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: purchase, error } = await context.supabase
      .from("purchases")
      .select("id, product_id")
      .eq("user_id", context.userId)
      .eq("paddle_transaction_id", data.sessionId)
      .eq("environment", data.environment)
      .eq("status", "completed")
      .maybeSingle();
    if (error) throw new Error("Could not confirm your payment");
    return { confirmed: Boolean(purchase), schoolBundle: purchase?.product_id === "school_interview_bundle" };
  });
