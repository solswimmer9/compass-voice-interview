import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { offerForPriceId } from "@/lib/offer";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(stripe: Stripe, options: { email?: string | undefined; userId: string }): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data[0]) {
      const customer = existing.data[0];
      if (customer.metadata?.['userId'] !== options.userId) {
        await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, userId: options.userId } });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { priceId: string; returnUrl: string; environment: "sandbox" | "live" }) => {
    if (!offerForPriceId(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(data.environment);
      const { data: userData } = await context.supabase.auth.getUser();
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: userData.user?.email ?? undefined,
        userId: context.userId,
      });
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: product.name },
        managed_payments: { enabled: true },
        metadata: { userId: context.userId, priceId: data.priceId, managed_payments: "true" },
      } as Stripe.Checkout.SessionCreateParams);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(error) };
    }
  });
