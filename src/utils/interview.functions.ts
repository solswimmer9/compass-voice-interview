import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isServerTester } from "@/lib/testers";

export const startPreviewInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ openingTurn: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!isServerTester(context.claims.email)) {
      throw new Error(
        "Unlimited testing is only available to tester accounts. Sign in with a tester account.",
      );
    }
    const { createElevenLabsSession } = await import("@/lib/elevenlabs-interview.server");
    const session = await createElevenLabsSession(data.openingTurn);
    return { ...session, interviewId: "preview" };
  });

export const startInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      openingTurn: z.number().int().positive(),
      environment: z.enum(["sandbox", "live"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { createElevenLabsSession } = await import("@/lib/elevenlabs-interview.server");
    const session = await createElevenLabsSession(data.openingTurn);
    const { data: allowance, error } = await context.supabase.rpc("consume_interview_credit", {
      p_environment: data.environment,
    });
    if (error) throw new Error("Your interview allowance could not be checked");
    const result = allowance as { allowed?: boolean; interviewId?: string } | null;
    if (!result?.allowed || !result.interviewId) {
      throw new Error("Your free interview has been used. Buy the 2-Interview Pack to continue.");
    }
    return { ...session, interviewId: result.interviewId };
  });

export const releaseInterviewCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ interviewId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("release_interview_credit", {
      p_interview_id: data.interviewId,
    });
    if (error) throw new Error("The unused interview could not be restored");
    return { released: true };
  });
