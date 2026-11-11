import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { offerForPriceId } from "@/lib/offer";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data[0]) {
      const customer = existing.data[0];
      if (customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
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
  .validator((data: { priceId: string; returnUrl: string; environment?: "sandbox" | "live" }) => {
    if (!offerForPriceId(data.priceId)) throw new Error("Invalid priceId");
    if (
      data.environment !== undefined &&
      data.environment !== "sandbox" &&
      data.environment !== "live"
    )
      throw new Error("Invalid environment");
    if (typeof data.returnUrl !== "string") throw new Error("Invalid returnUrl");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { createStripeClient, checkoutReturnUrl } = await import("@/lib/stripe.server");
      const { resolvePaymentsEnvironment } = await import("@/lib/payments-env.server");
      // The server decides sandbox or live; the browser's value is only checked against it.
      const environment = resolvePaymentsEnvironment(data.environment);
      const request = getRequest();
      const origin = request.headers.get("origin") ?? new URL(request.url).origin;
      const returnUrl = checkoutReturnUrl(data.returnUrl, origin);
      if (!returnUrl) return { error: "Checkout could not start from this page." };
      const stripe = createStripeClient(environment);
      const { data: userData } = await context.supabase.auth.getUser();
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");
      const productId =
        typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: userData.user?.email ?? undefined,
        userId: context.userId,
      });
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: returnUrl,
        customer: customerId,
        payment_intent_data: { description: product.name },
        managed_payments: { enabled: true },
        metadata: { userId: context.userId, priceId: data.priceId, managed_payments: "true" },
      } as Stripe.Checkout.SessionCreateParams);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      if (error instanceof Error && error.name === "PaymentsEnvironmentError")
        return { error: error.message };
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(error) };
    }
  });
