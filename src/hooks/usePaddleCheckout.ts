import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string | undefined;
    userId: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be opened");
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading, error };
}
