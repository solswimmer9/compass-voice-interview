import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const SELLER_NAME = "Solomon Allen";
export const LEGAL_UPDATED = "10 November 2026";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to practice
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:underline">
        {children}
      </div>
    </main>
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
      <p className="mt-2">© 2026 {SELLER_NAME}. Payments by Stripe.</p>
    </footer>
  );
}
