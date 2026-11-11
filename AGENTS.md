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

## Working here

- Skills: `context-layer` (where agent context goes), `task-lifecycle` (spec to merge), `loop-design` (recurring work), in `.claude/skills/`.
- Read `.claude/merge-gate.md` before merging to `main`; never edit it without the owner. Words for prompts: `docs/glossary.md`.

## Voice architecture

- Live interviews use Lovable AI Gateway Live through the persistent server relay and browser WebRTC hook; keep `LOVABLE_API_KEY` server-only. Post-interview assessments continue to use Lovable AI Gateway. This preserves natural two-way speech without depending on a separate voice-provider account.

## Accounts and payments

- Lovable Cloud owns customer profiles, purchases, and interview allowances; enforce credits and one-feedback-per-interview in server-side database functions, never client checks alone. Built-in Stripe embedded checkout (managed tax handling) and its signed webhook credit the one-off pack so entitlements remain consistent across preview and live environments.
- Unlimited testing is granted only to signed-in accounts listed in the `PREVIEW_TESTER_EMAILS` secret, checked on the server by `src/lib/testers.ts` (feedback in `assess.server.ts`, voice in `live-relay.server.ts`). Never grant free access by request hostname, web address, environment flags or build mode: on the published site the server sees internal hostnames that `isPreviewHostname` accepts, which previously let signed-out visitors skip sign-in and payment. `src/lib/preview.ts` is browser-only and only chooses which UI to show. Do not remove `testers.ts` or weaken `src/test/assess-access.test.ts` / `src/test/live-interview.test.ts`; if a tester is blocked, add their email to the secret.
- PPE interviews with Prof Matt (`src/lib/ppe.server.ts`) follow the same rules as geography: sign-in plus one interview credit in `live-relay.server.ts`, one feedback per interview in `assess.server.ts`. Students only ever hear approved PPE cards and get feedback from approved notes; only tester accounts hear drafts. Covered by `src/test/live-interview.test.ts`, `src/test/assess-access.test.ts` and `src/test/ppe.test.ts`.
- Lifetime access is a purchase of `LIFETIME_ACCESS` (`src/lib/offer.ts`) recorded with `LIFETIME_INTERVIEWS` credits, so the existing credit, refund and one-feedback-per-interview database rules apply unchanged.
- School purchases hold no personal credits: database triggers create a shared bundle, atomic signed-in claims create expiring student purchases, and refund/dispute triggers revoke all linked claims; this preserves existing interview and feedback enforcement without exposing student reports to teachers.
