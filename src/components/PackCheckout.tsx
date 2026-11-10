import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { INTERVIEW_PACK } from "@/lib/offer";

export function PackCheckout() {
  const { user } = useAuth();
  const checkout = usePaddleCheckout();

  return (
    <section id="interview-pack" className="mt-10 rounded-md border bg-card p-6 text-left">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">One-off pack</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-semibold">{INTERVIEW_PACK.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{INTERVIEW_PACK.description}</p>
        </div>
        <p className="font-serif text-4xl font-semibold">{INTERVIEW_PACK.displayPrice}</p>
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        <li>2 voice interviews with Dr River</li>
        <li>1 AI feedback assessment per interview</li>
        <li>No subscription or recurring payment</li>
      </ul>
      <div className="mt-6">
        {user ? (
          <button
            type="button"
            disabled={checkout.loading}
            onClick={() =>
              void checkout.openCheckout({
                priceId: INTERVIEW_PACK.priceId,
                customerEmail: user.email,
                userId: user.id,
              })
            }
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-40"
          >
            {checkout.loading ? "Opening checkout…" : `Buy pack · ${INTERVIEW_PACK.displayPrice}`}
          </button>
        ) : (
          <Link
            to="/auth"
            className="inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Sign in to buy
          </Link>
        )}
      </div>
      {checkout.error && <p role="alert" className="mt-4 text-sm text-destructive">{checkout.error}</p>}
    </section>
  );
}
