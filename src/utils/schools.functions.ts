import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isServerTester } from "@/lib/testers";

const environment = z.enum(["sandbox", "live"]);
export const getSchoolBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environment }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("school_bundles")
      .select("id, code, interviews_remaining, max_students, expires_at, status")
      .eq("owner_id", context.userId)
      .eq("environment", data.environment)
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
    // Test-mode school codes cost nothing, so only tester accounts may claim them.
    if (data.environment === "sandbox") {
      const { data: user } = await context.supabase.auth.getUser();
      if (!isServerTester(user.user?.email)) {
        return { error: "Test-mode school codes are only for tester accounts." };
      }
    }
    const result = await context.supabase.rpc("claim_school_interview", {
      p_code: data.code,
      p_environment: data.environment,
    });
    if (result.error) return { error: result.error.message };
    return { claimed: true };
  });
