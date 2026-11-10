import { useCallback, useMemo } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

export function StripeEmbeddedCheckout({ priceId }: { priceId: string }) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        returnUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout did not start");
    return result.clientSecret;
  }, [priceId]);
  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);
  const stripe = useMemo(() => getStripe(), []);
  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripe} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
