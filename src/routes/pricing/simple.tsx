import { createFileRoute } from "@tanstack/react-router";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { Check, PRICING_FACTS, PricingShell, pricingHead } from "@/components/pricing/PricingShell";

export const Route = createFileRoute("/pricing/simple")({
  head: () => pricingHead("Pricing"),
  component: SimplePricing,
});

function SimplePricing() {
  const { pack, free, minutes } = PRICING_FACTS;
  return (
    <PricingShell>
      <section className="mx-auto mt-20 max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-balance">
          Practise first. Pay later.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your first {free === 1 ? "interview is" : `${free} interviews are`} free. If Dr River
          helps, pick up two more.
        </p>
      </section>

      <section className="mx-auto mt-12 max-w-md overflow-hidden rounded-xl border bg-card">
        <div className="border-b border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{pack.name}</p>
          <p className="mt-2 font-serif text-7xl font-semibold tracking-tight">
            {pack.displayPrice}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">one-off · no subscription</p>
        </div>
        <ul className="space-y-3 p-8 text-sm">
          <li className="flex gap-3">
            <Check />
            {pack.interviews} voice interviews with Dr River, up to {minutes} minutes each
          </li>
          <li className="flex gap-3">
            <Check />
            AI feedback on where your reasoning slipped, once per interview
          </li>
          <li className="flex gap-3">
            <Check />
            Full transcript replay of how you argued
          </li>
          <li className="flex gap-3">
            <Check />
            If the voice fails to connect, the interview is returned to you
          </li>
        </ul>
        <div className="px-8 pb-8">
          <BuyPackButton className="w-full" />
        </div>
      </section>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Not tried it yet? <StartFreeLink className="ml-2 px-4 py-2 text-sm" />
      </p>
    </PricingShell>
  );
}
