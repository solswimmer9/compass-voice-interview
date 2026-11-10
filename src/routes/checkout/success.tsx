import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Purchase complete | Oxbridge Interview Practice" },
      { name: "description", content: "Your interview purchase is complete." },
      { property: "og:title", content: "Your purchase is complete" },
      { property: "og:description", content: "Return to Dr River to keep practising." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Payment complete
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold">Your interviews are being added.</h1>
      <p className="mt-4 text-muted-foreground">
        This usually takes a few seconds. Return to your account to see the updated allowance.
      </p>
      <Link
        to="/account"
        className="mx-auto mt-8 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
      >
        View my allowance
      </Link>
    </main>
  );
}
