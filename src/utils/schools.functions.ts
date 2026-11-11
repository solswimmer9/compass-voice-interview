import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The browser's environment is optional and only checked; the server decides which to use.
const environment = z.enum(["sandbox", "live"]).optional();
async function serverEnvironment(requested: "sandbox" | "live" | undefined) {
  const { resolvePaymentsEnvironment } = await import("@/lib/payments-env.server");
  return resolvePaymentsEnvironment(requested);
}
export const getSchoolBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environment }))
  .handler(async ({ data, context }) => {
    const env = await serverEnvironment(data.environment);
    const result = await context.supabase
      .from("school_bundles")
      .select("id, code, interviews_remaining, max_students, expires_at, status")
      .eq("owner_id", context.userId)
      .eq("environment", env)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const claimSchoolInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environment,
      code: z
        .string()
        .trim()
        .regex(/^[a-fA-F0-9]{32}$/, "Enter the full school code"),
    }),
  )
  .handler(async ({ data, context }) => {
    let env: "sandbox" | "live";
    try {
      env = await serverEnvironment(data.environment);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Payments are not set up" };
    }
    const result = await context.supabase.rpc("claim_school_interview", {
      p_code: data.code,
      p_environment: env,
    });
    if (result.error) return { error: result.error.message };
    return { claimed: true };
  });
