<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Voice architecture

- Select each tutor's output voice in the server-owned Live startup payload, keeping it scoped to the connection so changing one tutor cannot change another.

- Live interviews use Lovable AI Gateway Live through the persistent server relay and browser WebRTC hook; keep `LOVABLE_API_KEY` server-only. Post-interview assessments continue to use Lovable AI Gateway. This preserves natural two-way speech without depending on a separate voice-provider account.

## Accounts and payments

- Lovable Cloud owns customer profiles, purchases, and interview allowances; enforce credits and one-feedback-per-interview in server-side database functions, never client checks alone. Built-in Stripe embedded checkout (managed tax handling) and its signed webhook credit the one-off pack so entitlements remain consistent across preview and live environments.
- Unlimited testing is granted only to signed-in accounts listed in the `PREVIEW_TESTER_EMAILS` secret, checked on the server by `src/lib/testers.ts` (feedback in `assess.server.ts`, voice in `live-relay.server.ts`). Never grant free access by request hostname, web address, environment flags or build mode: on the published site the server sees internal hostnames that `isPreviewHostname` accepts, which previously let signed-out visitors skip sign-in and payment. `src/lib/preview.ts` is browser-only and only chooses which UI to show. Do not remove `testers.ts` or weaken `src/test/assess-access.test.ts` / `src/test/live-interview.test.ts`; if a tester is blocked, add their email to the secret.
- PPE interviews with Prof Matt (`src/lib/ppe.server.ts`) follow the same rules as geography: sign-in plus one interview credit in `live-relay.server.ts`, one feedback per interview in `assess.server.ts`. Students only ever hear approved PPE cards and get feedback from approved notes; only tester accounts hear drafts. Covered by `src/test/live-interview.test.ts`, `src/test/assess-access.test.ts` and `src/test/ppe.test.ts`.
- Only the server gives back an interview credit, for a call it saw fail to start: `releaseInterviewCredit` in `src/lib/live-relay.server.ts` calls `release_interview_credit(p_interview_id, p_user_id)`, which only the service role may execute. Never call it, or any credit-restoring function, with a student's own sign-in. Covered by `src/test/credit-release.test.ts`.
- Test-mode (sandbox) checkout, school claims and interviews are refused for non-tester accounts on the server, because test purchases cost nothing; only the live environment unlocks real interviews for students.
- Refunds and disputes go through the service-role `revoke_purchase` function, which records the revocation before updating purchases; a purchase recorded later for the same checkout session is saved already revoked, so out-of-order Stripe events cannot leave credits behind. Covered by `src/test/payment-revocation.test.ts`.
- Lifetime access is a purchase of `LIFETIME_ACCESS` (`src/lib/offer.ts`) recorded with `LIFETIME_INTERVIEWS` credits, so the existing credit, refund and one-feedback-per-interview database rules apply unchanged.
- School purchases hold no personal credits: database triggers create a shared bundle, atomic signed-in claims create expiring student purchases, and refund/dispute triggers revoke all linked claims; this preserves existing interview and feedback enforcement without exposing student reports to teachers.

## Tester-only trials

- Signed-in tester accounts get Dr River built from approved geography cards (`src/lib/geography.server.ts`). Every other account must keep the existing interview prompt unchanged, except that every normal (non-reading) interview appends its tutor's approved mid-interview chart section (`objectMidwaySection`, revealed after `OBJECT_REVEAL_MINUTES`; owner's decision, 13 November 2026); `src/test/geography-cards.test.ts` guards this.
- Every tutor's speaking rules (mannerisms, pauses, fillers, follow-ups, noise and interruptions, delegation) live once in `VOICE_POLICY` in `src/content/core.ts`, used by the fixed Dr River prompt and every card session, so students, testers and Prof Matt get the same behaviour; keep it short, because PPE and card sessions sit near the 2,000-word live limit. `src/test/interview-sharpness.test.ts` guards this.
- Topic cards and their approval rules: `src/content/README.md`.
- The Live relay sends the opening instructions and the "begin now" commentary back to back once media is ready, without waiting for the first acknowledgement; the gateway applies them in order, and waiting added about a second of silence.
- Dr River's assumption-testing rules live once in `src/content/tutors/geography/assumptions.ts` and feed both the student prompt and tester card sessions, so the two versions push the same way.

## Biology roadmap interviews

- Dr Toby (biology, `src/lib/biology.server.ts`) runs one roadmap scenario per interview (`src/content/scenarios/`), not topic cards. His live prompt holds only the current step; the roadmap checker (`src/lib/interview/roadmap.ts`) runs one text-model call per student turn for every account, moves him on, gives the answer after the hints run out, and shows each step's diagram. Students get approved scenarios only. `src/test/biology-roadmap.test.ts` and the biology block in `src/test/live-interview.test.ts` guard this.

## Feedback

- Every account gets quote-checked feedback for transcripts with at least two student turns (owner's decision, 14 November 2026): see `src/lib/feedback/README.md`. Students' analyst sees approved notes only; draft PPE notes stay tester-only. Any failure falls back silently to the single-call feedback, which also handles videos and very short transcripts. `src/test/assess-grounded.test.ts` and `src/test/assess-access.test.ts` guard this.

## Turn analyst and phase director

- Rules for the director, turn analyst and interview manifest live in `src/lib/interview/CLAUDE.md`, next to the code. Model names live only in `src/lib/models.ts`.
