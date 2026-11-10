import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { INTERVIEW_PACK } from "@/lib/offer";
import { cn } from "@/lib/utils";

/** Buy button for the interview pack. Sends signed-out visitors to sign in first. */
export function BuyPackButton({ className, label }: { className?: string; label?: string }) {
  const { user, loading } = useAuth();
  const checkout = usePaddleCheckout();
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
        disabled={loading || checkout.loading || !user}
        onClick={() =>
          user &&
          void checkout.openCheckout({
            priceId: INTERVIEW_PACK.priceId,
            customerEmail: user.email,
            userId: user.id,
          })
        }
        className={cn(base, className)}
      >
        {checkout.loading
          ? "Opening checkout…"
          : (label ?? `Buy the pack · ${INTERVIEW_PACK.displayPrice}`)}
      </button>
      {checkout.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {checkout.error}
        </p>
      )}
    </div>
  );
}

/** Start-free button: signed-in visitors go to the interview, others to sign in. */
export function StartFreeLink({ className }: { className?: string }) {
  const { user } = useAuth();
  return (
    <Link
      to={user ? "/" : "/auth"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-6 py-3 font-medium transition hover:bg-secondary",
        className,
      )}
    >
      {user ? "Use my free interview" : "Start free"}
    </Link>
  );
}
