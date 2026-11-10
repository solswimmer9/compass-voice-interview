import { createFileRoute } from "@tanstack/react-router";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { Check, PRICING_FACTS, PricingShell, pricingHead } from "@/components/pricing/PricingShell";

export const Route = createFileRoute("/pricing/compare")({
  head: () => pricingHead("Compare plans"),
  component: ComparePricing,
});

function ComparePricing() {
  const { pack, free, minutes } = PRICING_FACTS;
  const rows: { label: string; free: string; pack: string }[] = [
    { label: "Voice interviews with Dr Hale", free: String(free), pack: String(pack.interviews) },
    {
      label: "Length of each interview",
      free: `Up to ${minutes} min`,
      pack: `Up to ${minutes} min`,
    },
    { label: "Transcript replay", free: "Yes", pack: "Yes" },
    { label: "AI reasoning feedback", free: "Yes", pack: "After each interview" },
    { label: "Optional video for delivery feedback", free: "Yes", pack: "Yes" },
    { label: "Interview returned if the voice fails", free: "Yes", pack: "Yes" },
    { label: "Subscription", free: "None", pack: "None, one-off" },
  ];

  return (
    <PricingShell wide>
      <section className="mt-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-balance">
          Start free. Add interviews when you need them.
        </h1>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <article className="flex flex-col rounded-xl border p-8">
          <h2 className="text-sm text-muted-foreground">First interview</h2>
          <p className="mt-2 font-serif text-5xl font-semibold">Free</p>
          <p className="mt-2 text-sm text-muted-foreground">Just sign in. No card needed.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              {free} full voice interview with Dr Hale
            </li>
            <li className="flex gap-3">
              <Check />
              Transcript replay and AI feedback
            </li>
          </ul>
          <StartFreeLink className="mt-8 w-full" />
        </article>

        <article className="relative flex flex-col rounded-xl border border-accent/60 bg-card p-8">
          <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            After your free interview
          </span>
          <h2 className="text-sm text-muted-foreground">{pack.name}</h2>
          <p className="mt-2 font-serif text-5xl font-semibold">{pack.displayPrice}</p>
          <p className="mt-2 text-sm text-muted-foreground">One-off payment. No subscription.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            <li className="flex gap-3">
              <Check />
              {pack.interviews} more voice interviews with Dr Hale
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after each one
            </li>
            <li className="flex gap-3">
              <Check />
              Practise new questions as Dr Hale rotates his openers
            </li>
          </ul>
          <div className="mt-8">
            <BuyPackButton className="w-full" />
          </div>
        </article>
      </section>

      <section className="mt-16 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">What you get</th>
              <th className="p-4 font-medium">Free</th>
              <th className="p-4 font-medium">{pack.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <td className="p-4">{row.label}</td>
                <td className="p-4 text-muted-foreground">{row.free}</td>
                <td className="p-4">{row.pack}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PricingShell>
  );
}
