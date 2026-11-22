# Merge gate

Read before merging anything to `main`. Agents must not edit this file without the owner's
explicit agreement.

Auto-merge to `main` only when all three hold:

1. **Simple:** the change can be described in one short sentence.
2. **Checked for its kind:** cosmetic changes (copy, spacing, colour, icons) have one review round
   and before/after screenshots; logic changes have two review rounds, green CI, and a browser run
   of every new or changed user flow.
3. **Cheap if wrong:** revertible, and nobody could lose money, lose access, or have data go
   anywhere it should not.

Always hold for the owner, whatever the size:

- Sign-in, sessions, tester access (`src/lib/testers.ts`, `src/lib/request-auth.server.ts`).
- Credits, feedback allowances, payments, Stripe, pricing, school bundles.
- Anything Lovable manages: `supabase/`, `drizzle/`, secrets, generated files (do not edit by hand).
- Legal pages: terms, privacy, refunds, and the seller name.
- Approving tutor content (`status: "approved"`) or changing a tutor's persona or reading list.
- Changes to tests that guard access (`src/test/assess-access.test.ts`,
  `src/test/live-interview.test.ts`, `src/test/ppe.test.ts`).

When held: open or update the pull request with the evidence (checks, screenshots, what was not
verified) and ask. An explicit "merge it" from the owner in the conversation is the approval.
