import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, SELLER_NAME } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "Terms for using the Oxbridge geography, PPE and biology voice interview practice service.",
      },
      { property: "og:title", content: "Terms & Conditions | Oxbridge Interview Practice" },
      {
        property: "og:description",
        content: "Terms for using the Oxbridge geography, PPE and biology voice interview practice service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions">
      <p>
        This service (Oxbridge geography, PPE and biology interview practice with AI voice tutors and AI
        feedback) is provided by {SELLER_NAME} ("we", "us"). When you use it, your contract is with{" "}
        {SELLER_NAME}. By using the service you agree to these terms.
      </p>
      <h2>The service</h2>
      <p>
        We offer AI-led mock interviews and written AI feedback on your reasoning. It is a practice
        tool; it does not guarantee any admissions outcome and is not affiliated with any
        university.
      </p>
      <h2>Your account</h2>
      <p>
        You must give accurate information, keep your login details confidential, and you are
        responsible for activity on your account. If you are under 18 you should have permission
        from a parent or guardian.
      </p>
      <h2>Acceptable use</h2>
      <p>You must not misuse the service, including by:</p>
      <ul>
        <li>using it unlawfully, or for fraud or spam;</li>
        <li>infringing anyone's intellectual property;</li>
        <li>
          interfering with its security, e.g. malware, probing, scraping, or bypassing limits;
        </li>
        <li>reverse engineering, reselling or redistributing the service;</li>
        <li>
          trying to make the AI produce illegal, hateful, harassing or deceptive content (including
          impersonation or deepfakes), or attempting to jailbreak it.
        </li>
      </ul>
      <h2>AI content</h2>
      <p>
        You are responsible for what you say or upload and must have the right to share it. AI
        responses and feedback can be inaccurate or incomplete — check anything important yourself.
        You keep any rights you hold in your input; you may use the feedback for your own
        preparation. We may refuse, filter or remove content and restrict accounts that break these
        terms. To report content that infringes your rights, contact us through your account email
        and we will review and remove it where appropriate; repeat infringers will lose access.
      </p>
      <h2>Intellectual property</h2>
      <p>
        We own the service and its software, content, documentation and branding. We give you a
        limited, personal, non-transferable licence to use it within what you have bought.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are taken securely by our payment processor, Stripe. Prices are shown in GBP. Any
        applicable tax, such as UK VAT, is added at checkout, and you see the full total before you
        pay. Refunds are covered by our Refund Policy. Our offers are one-off payments, not
        subscriptions.
      </p>
      <h2>Availability</h2>
      <p>
        We do not guarantee the service will be uninterrupted or error-free. To the fullest extent
        permitted by law, it is provided "as is" without implied warranties.
      </p>
      <h2>Suspension and termination</h2>
      <p>
        We may suspend or end your access for a material breach of these terms, non-payment, a
        security or fraud risk, or repeated or serious violations. You can stop using the service at
        any time.
      </p>
      <h2>Liability</h2>
      <p>
        Our total liability is limited to what you paid us in the 12 months before the claim. We are
        not liable for indirect or consequential loss. Nothing limits liability for death or
        personal injury caused by negligence, fraud, or anything else that cannot be limited by law.
      </p>
      <h2>General</h2>
      <p>
        These terms are governed by the laws of England and Wales, and its courts have jurisdiction.
        We are not responsible for delays caused by events beyond our reasonable control.
      </p>
    </LegalLayout>
  );
}
