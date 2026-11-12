import { createFileRoute } from "@tanstack/react-router";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { Check, PRICING_FACTS, PricingShell, pricingHead } from "@/components/pricing/PricingShell";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { LIFETIME_ACCESS, SCHOOL_BUNDLE } from "@/lib/offer";

export const Route = createFileRoute("/pricing/lifetime")({
  head: () => pricingHead("Lifetime access"),
  component: LifetimePricing,
});

function LifetimePricing() {
  const { pack, free, minutes } = PRICING_FACTS;
  const account = useAccountSnapshot();
  const user = account.user;
  const hasLifetime = Boolean(account.data?.lifetime);

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
        <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Built on real Cambridge context.</span> Made
          by Cambridge students and informed by real Cambridge geography notes, so Dr River covers
          more ground than any one interviewer can hold in their head.
        </p>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl items-stretch gap-6 lg:grid-cols-3">
        <article className="flex flex-col rounded-xl border p-8">
          <h2 className="text-sm text-muted-foreground">{pack.name}</h2>
          <p className="mt-2 font-serif text-5xl font-semibold">{pack.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">For a quick top-up.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              {pack.interviews} voice interviews with Dr River or Prof Matt
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after each one
            </li>
          </ul>
          <div className="mt-8">
            {hasLifetime ? (
              <p className="rounded-full border px-6 py-3 text-center text-sm text-muted-foreground">
                Included in your lifetime access
              </p>
            ) : (
              <BuyPackButton className="w-full" />
            )}
          </div>
        </article>

        <article className="relative flex flex-col rounded-xl border border-accent bg-card p-8 shadow-[0_0_0_1px_var(--accent)]">
          <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Best for the full run-up
          </span>
          <h2 className="text-sm text-muted-foreground">{LIFETIME_ACCESS.name}</h2>
          <p className="mt-2 font-serif text-6xl font-semibold">{LIFETIME_ACCESS.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">One payment. Yours to keep.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              Unlimited voice interviews with Dr River or Prof Matt, up to {minutes} minutes each
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
          <div className="mt-8">
            {hasLifetime ? (
              <p className="rounded-full border px-6 py-3 text-center font-medium">
                You have lifetime access
              </p>
            ) : (
              <BuyPackButton
                className="w-full"
                offer={LIFETIME_ACCESS}
                label={`Get lifetime access · ${LIFETIME_ACCESS.displayPrice}`}
              />
            )}
          </div>
        </article>
        <article className="flex flex-col rounded-xl border p-8">
          <h2 className="text-sm text-muted-foreground">For schools</h2>
          <p className="mt-2 font-serif text-5xl font-semibold">{SCHOOL_BUNDLE.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">Per admissions cycle.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              {SCHOOL_BUNDLE.interviews} shared voice interviews with Dr River or Prof Matt
            </li>
            <li className="flex gap-3">
              <Check />
              Up to {SCHOOL_BUNDLE.maxStudents} students, with one school code
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after each interview
            </li>
          </ul>
          <div className="mt-8">
            <BuyPackButton className="w-full" offer={SCHOOL_BUNDLE} />
          </div>
        </article>
      </section>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Not sure yet?{" "}
        {user && !account.data ? (
          <span className="ml-2 inline-block px-4 py-2 text-sm" aria-hidden="true">
            …
          </span>
        ) : (
          <StartFreeLink
            className="ml-2 px-4 py-2 text-sm"
            freeLeft={!account.data || account.data.freeRemaining > 0}
          />
        )}
      </p>
    </PricingShell>
  );
}
