import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_INTERVIEWS, LIFETIME_ACCESS } from "@/lib/offer";

const environmentSchema = z.enum(["sandbox", "live"]);

export const getAccountSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ environment: environmentSchema }))
  .handler(async ({ data, context }) => {
    const [profile, purchases, freeSessions] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("purchases")
        .select("id, interviews_remaining, created_at, product_id")
        .eq("user_id", context.userId)
        .eq("environment", data.environment)
        .eq("status", "completed")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("interview_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("environment", data.environment)
        .is("purchase_id", null),
    ]);
    if (profile.error || purchases.error || freeSessions.error)
      throw new Error("Could not load your account");
    const paidRemaining = (purchases.data ?? []).reduce(
      (sum, purchase) => sum + purchase.interviews_remaining,
      0,
    );
    const lifetime = (purchases.data ?? []).some(
      (purchase) => purchase.product_id === LIFETIME_ACCESS.productId,
    );
    return {
      profile: profile.data,
      lifetime,
      purchases: purchases.data ?? [],
      freeRemaining: Math.max(0, FREE_INTERVIEWS - (freeSessions.count ?? 0)),
      paidRemaining,
      totalRemaining: Math.max(0, FREE_INTERVIEWS - (freeSessions.count ?? 0)) + paidRemaining,
    };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ displayName: z.string().trim().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      display_name: data.displayName,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save your display name");
    return { displayName: data.displayName };
  });
