import { createFileRoute } from "@tanstack/react-router";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { Check, PRICING_FACTS, PricingShell, pricingHead } from "@/components/pricing/PricingShell";

// DRAFT: the lifetime option is not set up in checkout or in the interview
// allowance logic yet, so its button is disabled. See the branch notes.
const LIFETIME_DRAFT = {
  name: "Lifetime access",
  displayPrice: "£100",
};

export const Route = createFileRoute("/pricing/lifetime")({
  head: () => pricingHead("Lifetime access"),
  component: LifetimePricing,
});

function LifetimePricing() {
  const { pack, free, minutes } = PRICING_FACTS;

  return (
    <PricingShell wide>
      <section className="mt-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-balance">
          Pay once. Practise until your interview.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your first {free === 1 ? "interview is" : `${free} interviews are`} free. No
          subscriptions, ever.
        </p>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl items-stretch gap-6 md:grid-cols-[1fr_1.15fr]">
        <article className="flex flex-col rounded-xl border p-8">
          <h2 className="text-sm text-muted-foreground">{pack.name}</h2>
          <p className="mt-2 font-serif text-5xl font-semibold">{pack.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">For a quick top-up.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              {pack.interviews} voice interviews with Dr River
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after each one
            </li>
          </ul>
          <div className="mt-8">
            <BuyPackButton className="w-full" />
          </div>
        </article>

        <article className="relative flex flex-col rounded-xl border border-accent bg-card p-8 shadow-[0_0_0_1px_var(--accent)]">
          <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Best for the full run-up
          </span>
          <h2 className="text-sm text-muted-foreground">{LIFETIME_DRAFT.name}</h2>
          <p className="mt-2 font-serif text-6xl font-semibold">{LIFETIME_DRAFT.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">One payment. Yours to keep.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              Unlimited voice interviews with Dr River, up to {minutes} minutes each
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after every interview
            </li>
            <li className="flex gap-3">
              <Check />
              Transcript replay and optional video feedback on delivery
            </li>
            <li className="flex gap-3">
              <Check />
              Every new question and feature we add
            </li>
          </ul>
          <button
            type="button"
            disabled
            className="mt-8 w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-40"
          >
            Coming soon · {LIFETIME_DRAFT.displayPrice}
          </button>
        </article>
      </section>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Not sure yet? <StartFreeLink className="ml-2 px-4 py-2 text-sm" />
      </p>
    </PricingShell>
  );
}
