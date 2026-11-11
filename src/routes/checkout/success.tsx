import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getPaymentsEnvironment } from "@/lib/stripe";
import { confirmCheckoutSession } from "@/utils/checkout.functions";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    ...(typeof search["session_id"] === "string" && search["session_id"]
      ? { session_id: search["session_id"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Purchase | Oxbridge Interview Practice" },
      { name: "description", content: "Confirming your interview purchase." },
      { property: "og:title", content: "Your purchase" },
      { property: "og:description", content: "Return to Dr River to keep practising." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutSuccessPage,
});

const MAX_ATTEMPTS = 6;
const POLL_MS = 2_000;

function CheckoutSuccessPage() {
  const { session_id: sessionId } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const [attempts, setAttempts] = useState(0);
  const query = useQuery({
    queryKey: ["checkout-confirmation", user?.id, sessionId],
    enabled: Boolean(user && sessionId),
    queryFn: async () => {
      if (!sessionId) throw new Error("Missing checkout reference");
      try {
        return await confirmCheckoutSession({
          data: { sessionId, environment: getPaymentsEnvironment() },
        });
      } finally {
        setAttempts((n) => n + 1);
      }
    },
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.confirmed || attempts >= MAX_ATTEMPTS ? false : POLL_MS,
  });

  const confirmed = query.data?.confirmed === true;
  const gaveUp = !confirmed && (query.isError || attempts >= MAX_ATTEMPTS);
  const waiting = loading || !user || (Boolean(sessionId) && !confirmed && !gaveUp);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      {confirmed ? (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Payment complete
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold">{query.data?.schoolBundle ? "Your school bundle is ready." : "Your interviews have been added."}</h1>
          <p className="mt-4 text-muted-foreground">{query.data?.schoolBundle ? "Your school code and shared balance are ready." : "Return to your account to see the updated allowance."}</p>
        </>
      ) : waiting ? (
        <>
          <h1 className="font-serif text-4xl font-semibold">Confirming your payment…</h1>
          <p className="mt-4 text-muted-foreground">This usually takes a few seconds.</p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-4xl font-semibold">We couldn't find this payment yet</h1>
          <p className="mt-4 text-muted-foreground">
            {sessionId
              ? "It may still be processing. Check your account in a minute, and contact us if your interviews don't appear."
              : "This page needs a checkout reference. Check your account to see your purchases."}
          </p>
        </>
      )}
      <Link
        to={query.data?.schoolBundle ? "/schools" : "/account"}
        className="mx-auto mt-8 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
      >
        {confirmed ? query.data?.schoolBundle ? "View school code" : "View my allowance" : "Go to my account"}
      </Link>
    </main>
  );
}
