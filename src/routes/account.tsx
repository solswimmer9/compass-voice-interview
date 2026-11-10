import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { LIFETIME_ACCESS, offerForProductId } from "@/lib/offer";
import { updateDisplayName } from "@/utils/account.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "Manage your display name, purchases, and interview allowance.",
      },
      { property: "og:title", content: "Your Oxbridge practice account" },
      {
        property: "og:description",
        content: "View your remaining interviews and purchase history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading, data, refetch } = useAccountSnapshot();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setDisplayName(data?.profile?.display_name ?? ""), [data?.profile?.display_name]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await updateDisplayName({ data: { displayName } });
      await refetch();
      setMessage("Display name saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your profile");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground">
        ← Back to interview practice
      </Link>
      <h1 className="mt-8 font-serif text-4xl font-semibold">Your account</h1>
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading your allowance…</p>
      ) : !user ? (
        <div className="mt-6">
          <p className="text-muted-foreground">
            Sign in to view purchases and interview allowance.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <section className="rounded-md border bg-card p-6">
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {data?.lifetime ? (
              <>
                <p className="mt-3 font-serif text-3xl font-semibold">Lifetime access</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unlimited interviews with Dr River
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-serif text-3xl font-semibold">
                  {data?.totalRemaining ?? 0}{" "}
                  {data?.totalRemaining === 1 ? "interview" : "interviews"} remaining
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data?.freeRemaining ?? 0} free · {data?.paidRemaining ?? 0} purchased
                </p>
              </>
            )}
            {data?.lifetime || (data?.totalRemaining ?? 0) > 0 ? (
              <Link
                to="/"
                className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
              >
                Start practising
              </Link>
            ) : (
              <Link
                to="/pricing"
                className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
              >
                Get more interviews
              </Link>
            )}
          </section>
          <form onSubmit={save} className="rounded-md border bg-card p-6">
            <h2 className="font-serif text-2xl font-semibold">Profile</h2>
            <label className="mt-4 block text-sm">
              Display name
              <input
                required
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <button className="mt-4 rounded-full border px-5 py-2 text-sm">Save profile</button>
          </form>
          <section className="rounded-md border bg-card p-6">
            <h2 className="font-serif text-2xl font-semibold">Purchase history</h2>
            {data?.purchases.length ? (
              <ul className="mt-4 space-y-3 text-sm">
                {data.purchases.map((purchase) => (
                  <li key={purchase.id} className="flex justify-between gap-4">
                    <span>
                      {offerForProductId(purchase.product_id)?.name ?? "Interview purchase"}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(purchase.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                    <span className="text-right text-muted-foreground">
                      {purchase.product_id === LIFETIME_ACCESS.productId
                        ? "Unlimited"
                        : `${purchase.interviews_remaining} remaining`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No purchases yet.</p>
            )}
          </section>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="text-sm underline"
          >
            Sign out
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </main>
  );
}
