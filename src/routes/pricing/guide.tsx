import { createFileRoute } from "@tanstack/react-router";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { Check, PRICING_FACTS, PricingShell, pricingHead } from "@/components/pricing/PricingShell";

export const Route = createFileRoute("/pricing/guide")({
  head: () => pricingHead("How it works and pricing"),
  component: GuidePricing,
});

function GuidePricing() {
  const { pack, free, minutes } = PRICING_FACTS;

  const steps = [
    {
      title: "Dr Hale asks",
      body: "A Cambridge-style geography question, the kind that has no single right answer.",
    },
    {
      title: "You think out loud",
      body: `Up to ${minutes} minutes. He pushes back on your reasoning the way a real interviewer would.`,
    },
    {
      title: "Read it back",
      body: "See the full transcript of how you argued, turn by turn.",
    },
    {
      title: "Get feedback",
      body: "AI feedback on where your reasoning slipped and what to try next. Add a video for notes on delivery.",
    },
  ];

  const faqs = [
    {
      q: "Do I need to pay to try it?",
      a: `No. Your first ${free === 1 ? "interview is" : `${free} interviews are`} free once you sign in.`,
    },
    {
      q: "Is this a subscription?",
      a: `No. The ${pack.name} is a one-off payment for ${pack.interviews} interviews.`,
    },
    {
      q: "What if the voice doesn't connect?",
      a: "If an interview fails to start, it is automatically returned to your allowance.",
    },
    {
      q: "Where can I see how many interviews I have left?",
      a: "On your account page, along with your purchase history.",
    },
  ];

  return (
    <PricingShell>
      <section className="mt-16">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          How it works
        </p>
        <h1 className="mt-4 max-w-2xl font-serif text-5xl font-semibold tracking-tight text-balance">
          A real interview rehearsal, not a quiz.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Built by Cambridge students. Dr Hale is informed by real Cambridge geography notes and
          will challenge how you think, not just what you know.
        </p>
      </section>

      <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="bg-background p-6">
            <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
            <h2 className="mt-2 font-medium">{step.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-16 grid items-center gap-8 rounded-xl border bg-card p-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Your first interview is free
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold">Then, the {pack.name}</h2>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-3">
              <Check />
              {pack.interviews} voice interviews with Dr Hale
            </li>
            <li className="flex gap-3">
              <Check />
              AI feedback after each one
            </li>
            <li className="flex gap-3">
              <Check />
              One-off, no subscription
            </li>
          </ul>
        </div>
        <div className="text-center md:text-right">
          <p className="font-serif text-6xl font-semibold">{pack.displayPrice}</p>
          <div className="mt-5 flex flex-col gap-3">
            <BuyPackButton />
            <StartFreeLink />
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-2xl font-semibold">Questions</h2>
        <div className="mt-4 divide-y rounded-xl border">
          {faqs.map((faq) => (
            <details key={faq.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {faq.q}
                <span className="text-muted-foreground transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </PricingShell>
  );
}
