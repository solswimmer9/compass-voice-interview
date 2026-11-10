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
        content: `Your first interview with Dr Hale is free. Then the ${INTERVIEW_PACK.name} gives you two more, each with AI reasoning feedback.`,
      },
      { property: "og:title", content: "Pricing · Oxbridge Interview Practice" },
      {
        property: "og:description",
        content: "One free practice interview, then a one-off pack. No subscription.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

const DESIGNS = [
  { to: "/pricing/simple", label: "1 · Simple" },
  { to: "/pricing/compare", label: "2 · Compare" },
  { to: "/pricing/guide", label: "3 · Guide" },
] as const;

/** Page frame with a back link and a switcher between the three draft designs. */
export function PricingShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen px-6 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← Back to interview practice
        </Link>
        <nav aria-label="Pricing design drafts" className="flex gap-1 rounded-full border p-1">
          {DESIGNS.map((design) => (
            <Link
              key={design.to}
              to={design.to}
              className="rounded-full px-3 py-1 text-xs text-muted-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {design.label}
            </Link>
          ))}
        </nav>
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
