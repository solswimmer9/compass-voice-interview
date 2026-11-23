import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MeridianPage, mono, serif } from "@/components/meridian/MeridianFrame";

export const SELLER_NAME = "Solomon Allen";
export const LEGAL_UPDATED = "22 November 2026";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MeridianPage
      framed={
        <main className="mx-auto max-w-2xl px-6 pb-16 pt-8 text-[#161616]">
          <Link to="/" className="text-sm text-[#4a4a48] hover:underline">
            ← Back to interview practice
          </Link>
          <h1 className={`${serif} mt-6 text-[clamp(40px,5vw,60px)] leading-none`}>{title}</h1>
          <p className={`${mono} mt-3 text-xs text-[#5a5a57]`}>
            LAST UPDATED {LEGAL_UPDATED.toUpperCase()}
          </p>
          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[#2a2a28] [&_a]:underline [&_h2]:mt-10 [&_h2]:font-instrument [&_h2]:text-[28px] [&_h2]:leading-tight [&_h2]:text-[#161616] [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </div>
        </main>
      }
    />
  );
}

export function LegalFooter() {
  return (
    <footer className="relative z-10 border-t px-6 py-6 text-center text-xs text-muted-foreground">
      <nav className="flex flex-wrap justify-center gap-4">
        <Link to="/terms" className="hover:text-foreground">
          Terms &amp; Conditions
        </Link>
        <Link to="/privacy" className="hover:text-foreground">
          Privacy Notice
        </Link>
        <Link to="/refunds" className="hover:text-foreground">
          Refund Policy
        </Link>
      </nav>
      <p className="mt-2">© 2026 Compass. Payments by Stripe.</p>
    </footer>
  );
}
