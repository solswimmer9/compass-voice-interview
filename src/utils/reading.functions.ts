import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Emails a practice reading to the signed-in student. It only ever sends to the
// account's own email, so it can't be used to send mail to other people.
export const emailReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ readingId: z.string().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    const { readingById } = await import("@/lib/readings");
    const { limitMessage } = await import("@/lib/rate-limit.server");
    const { sendReadingEmail, takeReadingEmail } = await import("@/lib/reading-email.server");
    const reading = readingById(data.readingId);
    if (!reading) throw new Error("That reading couldn't be found.");
    const email = context.claims.email;
    if (typeof email !== "string" || !email) throw new Error("Your account has no email address.");
    const allowed = takeReadingEmail(context.userId);
    if (!allowed.ok) throw new Error(limitMessage("reading emails", allowed.retryAfterMinutes));
    await sendReadingEmail({
      to: email,
      reading,
      requestOrigin: getRequest()?.headers.get("origin") ?? null,
    });
    return { sentTo: email };
  });
