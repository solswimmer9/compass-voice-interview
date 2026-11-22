import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FREE_INTERVIEWS, INTERVIEW_PACK } from "@/lib/offer";
import { INTERVIEW_MINUTES } from "@/lib/limits";

export const PRICING_FACTS = {
  free: FREE_INTERVIEWS,
  pack: INTERVIEW_PACK,
  minutes: INTERVIEW_MINUTES,
};

export function pricingHead(title: string) {
  return {
    meta: [
      { title: `${title} | Oxbridge Interview Practice` },
      {
        name: "description",
        content: `Your first two interviews with Dr River or Prof Matt are free. Then top up with the ${INTERVIEW_PACK.name} or get lifetime access, each interview with AI reasoning feedback.`,
      },
      { property: "og:title", content: "Pricing · Oxbridge Interview Practice" },
      {
        property: "og:description",
        content:
          "Two free practice interviews, then a one-off pack or lifetime access. No subscription.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

/** Page frame with a back link to the interview. */
export function PricingShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen px-6 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← Back to interview practice
        </Link>
        <Link to="/schools" className="text-muted-foreground hover:text-foreground">
          Schools
        </Link>
      </div>
      {children}
    </main>
  );
}

export function Check() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-accent">
      <path
        d="M3 8.5l3 3 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
