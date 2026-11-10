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

- Live interviews use ElevenLabs Conversational AI through `@elevenlabs/react` and server-minted WebSocket signed URLs; keep `ELEVENLABS_API_KEY` server-only. Post-interview assessments continue to use Lovable AI Gateway. This preserves natural two-way speech without exposing the provider credential.

## Accounts and payments

- Lovable Cloud owns customer profiles, purchases, and interview allowances; enforce credits and one-feedback-per-interview in server-side database functions, never client checks alone. Built-in Paddle checkout and its signed webhook credit the one-off pack so entitlements remain consistent across preview and live environments.
- Unlimited testing is preview-only and bypasses sign-in and allowances; gate it by the actual request hostname in `src/lib/preview.ts`, never by caller-supplied environment flags or development build mode, so published traffic keeps normal limits.
