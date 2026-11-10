import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { INTERVIEW_PACK, type Offer } from "@/lib/offer";
import { cn } from "@/lib/utils";

/** Buy button for an offer (the pack by default). Sends signed-out visitors to sign in first. */
export function BuyPackButton({
  className,
  label,
  offer = INTERVIEW_PACK,
}: {
  className?: string;
  label?: string;
  offer?: Offer;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const base =
    "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40";

  if (!loading && !user) {
    return (
      <Link to="/auth" className={cn(base, className)}>
        Sign in to buy
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading || !user}
        onClick={() => setOpen(true)}
        className={cn(base, className)}
      >
        {label ?? `Buy · ${offer.displayPrice}`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogTitle>{offer.name}</DialogTitle>
          {open && <StripeEmbeddedCheckout priceId={offer.priceId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Start-free button: signed-in visitors go to the interview, others to sign in. */
export function StartFreeLink({
  className,
  freeLeft = true,
}: {
  className?: string;
  /** Whether a signed-in user still has their free interview. */
  freeLeft?: boolean;
}) {
  const { user } = useAuth();
  return (
    <Link
      to={user ? "/" : "/auth"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-6 py-3 font-medium transition hover:bg-secondary",
        className,
      )}
    >
      {!user ? "Start free" : freeLeft ? "Use my free interview" : "Go to practice"}
    </Link>
  );
}
