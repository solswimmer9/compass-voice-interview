import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BuyPackButton, StartFreeLink } from "@/components/pricing/BuyPackButton";
import { PRICING_FACTS, pricingHead } from "@/components/pricing/PricingShell";
import { MeridianPage, mono, serif } from "@/components/meridian/MeridianFrame";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { LIFETIME_ACCESS, SCHOOL_BUNDLE } from "@/lib/offer";

export const Route = createFileRoute("/pricing/lifetime")({
  head: () => pricingHead("Lifetime access"),
  component: LifetimePricing,
});

const darkBuy = "w-full rounded bg-[#161616] text-[#f7f7f5] hover:bg-[#3a3a3a] hover:opacity-100";
const lightBuy = "w-full rounded bg-[#f7f7f5] text-[#161616] hover:bg-white hover:opacity-100";

function Tick({ light }: { light?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`mt-0.5 h-4 w-4 shrink-0 ${light ? "text-[#f7f7f5]" : "text-[#161616]"}`}
    >
      <path
        d="M3 8.5l3 3 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Plan({
  label,
  price,
  note,
  items,
  action,
  featured,
  badge,
}: {
  label: string;
  price: string;
  note: string;
  items: ReactNode[];
  action: ReactNode;
  featured?: boolean;
  badge?: string;
}) {
  return (
    <article
      className={`lift reveal relative flex flex-col rounded-[14px] p-8 ${featured ? "bg-[#161616] text-[#f7f7f5]" : "bg-[#f7f7f5]"}`}
    >
      {badge && (
        <span
          className={`${mono} absolute -top-3 left-8 rounded bg-[#ededeb] px-2.5 py-1 text-[11px] text-[#161616]`}
        >
          {badge}
        </span>
      )}
      <h2 className={`${mono} text-xs ${featured ? "text-[#c9c9c4]" : "text-[#5a5a57]"}`}>
        {label.toUpperCase()}
      </h2>
      <p className={`${serif} mt-4 text-[64px] leading-none`}>{price}</p>
      <p className={`mt-3 text-sm ${featured ? "text-[#d9d9d4]" : "text-[#4a4a48]"}`}>{note}</p>
      <ul
        className={`mt-6 flex-1 space-y-3 border-t pt-6 text-sm leading-relaxed ${featured ? "border-[#3a3a3a]" : "border-[#d6d6d2]"}`}
      >
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <Tick light={Boolean(featured)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">{action}</div>
    </article>
  );
}

function LifetimePricing() {
  const { pack, free, minutes } = PRICING_FACTS;
  const account = useAccountSnapshot();
  const user = account.user;
  const hasLifetime = Boolean(account.data?.lifetime);
  const ownedNote = (text: string, featured?: boolean) => (
    <p
      className={`rounded border px-6 py-3 text-center text-sm ${featured ? "border-[#3a3a3a]" : "border-[#d6d6d2] text-[#4a4a48]"}`}
    >
      {text}
    </p>
  );

  return (
    <MeridianPage
      framed={
        <section className="px-6 pb-16 pt-10 text-center sm:px-8 sm:pt-14">
          <div className="relative">
            <p className={`${mono} text-xs text-[#5a5a57]`}>PRICING</p>
            <h1
              className={`rise ${serif} mt-4 text-[clamp(44px,6vw,88px)] leading-[0.98] tracking-[-0.02em]`}
            >
              Pay once.
              <br />
              <em>Practise until your interview.</em>
            </h1>
            <p
              className="rise mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-[#4a4a48]"
              style={{ animationDelay: "0.15s" }}
            >
              Your first {free === 1 ? "interview is" : `${free} interviews are`} free. No
              subscriptions, ever.
            </p>
            <p
              className="rise mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#4a4a48]"
              style={{ animationDelay: "0.25s" }}
            >
              <span className="text-[#161616]">Built by Cambridge students.</span> Dr River draws on
              Cambridge geography notes. Compass is practice and is not affiliated with Oxford or
              Cambridge.
            </p>
          </div>
        </section>
      }
    >
      <main className="px-2 pb-24 pt-16">
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          <Plan
            label={pack.name}
            price={pack.displayPrice}
            note="For a quick top-up."
            items={[
              `${pack.interviews} voice interviews with Dr River, Prof Matt or Dr Toby`,
              "AI feedback after each one",
            ]}
            action={
              hasLifetime ? (
                ownedNote("Included in your lifetime access")
              ) : (
                <BuyPackButton className={darkBuy} />
              )
            }
          />
          <Plan
            featured
            badge="BEST FOR THE FULL RUN-UP"
            label={LIFETIME_ACCESS.name}
            price={LIFETIME_ACCESS.displayPrice}
            note="One payment. Yours to keep."
            items={[
              `Unlimited voice interviews with Dr River, Prof Matt or Dr Toby, up to ${minutes} minutes each`,
              "AI feedback after every interview",
              "Transcript replay and optional video feedback on delivery",
              "Every new question and feature we add",
            ]}
            action={
              hasLifetime ? (
                ownedNote("You have lifetime access", true)
              ) : (
                <BuyPackButton
                  className={lightBuy}
                  offer={LIFETIME_ACCESS}
                  label={`Get lifetime access · ${LIFETIME_ACCESS.displayPrice}`}
                />
              )
            }
          />
          <Plan
            label="For schools"
            price={SCHOOL_BUNDLE.displayPrice}
            note="Per admissions cycle."
            items={[
              `${SCHOOL_BUNDLE.interviews} shared voice interviews with Dr River, Prof Matt or Dr Toby`,
              `Up to ${SCHOOL_BUNDLE.maxStudents} students, with one school code`,
              "AI feedback after each interview",
            ]}
            action={<BuyPackButton className={darkBuy} offer={SCHOOL_BUNDLE} />}
          />
        </div>

        <p className={`${mono} mt-8 text-center text-[11px] text-[#5a5a57]`}>
          ONE-OFF PAYMENTS IN GBP · ANY TAX, SUCH AS UK VAT, IS ADDED AT CHECKOUT
        </p>

        <p className="mt-12 text-center text-sm text-[#4a4a48]">
          Not sure yet?{" "}
          {user && !account.data ? (
            <span className="ml-2 inline-block px-4 py-2 text-sm" aria-hidden="true">
              …
            </span>
          ) : (
            <StartFreeLink
              className="ml-2 rounded border-[#161616] px-5 py-2.5 text-sm text-[#161616] hover:bg-white"
              freeLeft={!account.data || account.data.freeRemaining > 0}
            />
          )}
        </p>
      </main>
    </MeridianPage>
  );
}
