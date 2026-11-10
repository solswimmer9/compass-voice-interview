import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, SELLER_NAME } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice | Oxbridge Interview Practice" },
      { name: "description", content: "How Oxbridge interview practice collects, uses and protects your personal data." },
      { property: "og:title", content: "Privacy Notice | Oxbridge Interview Practice" },
      { property: "og:description", content: "How Oxbridge interview practice collects, uses and protects your personal data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Notice">
      <p>
        {SELLER_NAME} ("we") is the data controller for personal data processed through this
        service. This notice explains what we collect, why, and your rights under UK GDPR.
      </p>
      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Account data</strong> (name, email, login details) — to create and run your
          account. Basis: contract.
        </li>
        <li>
          <strong>Interview content</strong> (live voice audio, transcripts, uploaded videos) — to
          run interviews and produce feedback. Basis: contract.
        </li>
        <li>
          <strong>Purchase records</strong> (what you bought, interviews remaining) — to provide what
          you paid for. Basis: contract and legal obligation.
        </li>
        <li>
          <strong>Technical data</strong> (IP address, device and browser info, usage logs) — for
          security, fraud prevention and improving the service. Basis: legitimate interests.
        </li>
        <li>
          <strong>Support messages</strong> — to help you. Basis: legitimate interests.
        </li>
      </ul>
      <p>Card and payment details are collected by Stripe, our payment processor, not by us.</p>
      <h2>Who we share it with</h2>
      <ul>
        <li>Service providers: hosting, database and authentication, and AI model providers that power the voice tutor and feedback.</li>
        <li>Stripe, our payment processor, for payments, fraud prevention, tax and receipts.</li>
        <li>Professional advisers (legal, accounting).</li>
        <li>Authorities where required by law.</li>
      </ul>
      <h2>International transfers</h2>
      <p>
        Some providers process data outside the UK. Where they do, we rely on adequacy decisions or
        standard contractual clauses (including the UK addendum).
      </p>
      <h2>Retention</h2>
      <p>
        We keep account and interview data while your account is active and delete or anonymise it
        when no longer needed. Purchase records are kept as long as the law requires (normally 6
        years). Uploaded videos are used only for the assessment you request.
      </p>
      <h2>Security</h2>
      <p>
        We use appropriate technical and organisational measures, including encryption in transit and
        access controls that restrict your data to your own account.
      </p>
      <h2>Cookies</h2>
      <p>
        We only use essential cookies and browser storage needed to keep you signed in and to run
        checkout. We do not use advertising cookies.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct, erase, restrict or move your data, object to processing, or
        withdraw consent. We respond within one month. Contact us via your account email. You can
        also complain to the Information Commissioner's Office (ico.org.uk).
      </p>
    </LegalLayout>
  );
}
