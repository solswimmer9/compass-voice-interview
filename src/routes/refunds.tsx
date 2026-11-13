import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, SELLER_NAME } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "30-day money-back guarantee on Oxbridge interview practice purchases.",
      },
      { property: "og:title", content: "Refund Policy | Oxbridge Interview Practice" },
      {
        property: "og:description",
        content: "30-day money-back guarantee on Oxbridge interview practice purchases.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <LegalLayout title="Refund Policy">
      <p>
        {SELLER_NAME} offers a 30-day money-back guarantee. If you're not satisfied with your
        purchase, you can request a full refund within 30 days of your order date.
      </p>
      <h2>How to request a refund</h2>
      <p>
        To request a refund, reply to your payment receipt email or contact us with the email
        address you used to buy. Approved refunds go back to your original payment method, usually
        within 5–10 working days.
      </p>
    </LegalLayout>
  );
}
