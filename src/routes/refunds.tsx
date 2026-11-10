import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, SELLER_NAME } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy | Oxbridge Interview Practice" },
      { name: "description", content: "30-day money-back guarantee on Oxbridge interview practice purchases." },
      { property: "og:title", content: "Refund Policy | Oxbridge Interview Practice" },
      { property: "og:description", content: "30-day money-back guarantee on Oxbridge interview practice purchases." },
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
        Refunds are processed by our payment provider and Merchant of Record, Paddle. To request one,
        visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
        and look up your order using the email on your receipt, or reply to your receipt email.
      </p>
      <p>
        See also{" "}
        <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
          Paddle's refund policy
        </a>
        .
      </p>
    </LegalLayout>
  );
}
