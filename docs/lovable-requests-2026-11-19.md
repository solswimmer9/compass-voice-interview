# Lovable requests, 19 November 2026

The database is managed by Lovable (see `AGENTS.md`), so these are written as messages to paste into the Lovable editor. Nothing here has been applied. Send them in this order, one at a time, and check each one before the next.

## 1. Close the free-interview refund hole (urgent)

Any signed-in account, including the new guest accounts, can call `release_interview_credit` directly from the browser after an interview and get the credit back. For a free interview this also resets the free allowance, so free interviews become unlimited. The app only ever refunds a call that failed to start, which it decides within about a minute, so limiting refunds to the first 90 seconds closes the hole without any app change.

> Please change `release_interview_credit(p_interview_id uuid)` so it only releases a session created in the last 90 seconds: add `AND created_at > now() - interval '90 seconds'` to its `SELECT ... FOR UPDATE`. Keep everything else about the function, its grants and all other functions exactly as they are.

Check afterwards: start an interview, talk for two minutes, end it, and confirm your remaining interview count did not go back up.

## 2. Two free tries for guests

The app now lets visitors start as an anonymous guest. Until this change, a guest gets one try, not two.

First, turn on anonymous sign-ins in Cloud → Users → Auth settings. Then:

> Update `consume_interview_credit` so anonymous users (`auth.jwt()->>'is_anonymous' = 'true'`) get 2 free interviews instead of 1: they may create a free session while they have fewer than 2 sessions with `purchase_id IS NULL` in that environment. If the unique index `one_free_interview_per_user_environment` prevents a second free row, exclude anonymous users' rows from it or replace it with the count check. Keep 1 free interview for normal accounts and keep every other rule the same.

Check afterwards: in a private window, do two guest interviews; the third should ask you to sign in.

## 3. Saved transcripts and student memory (after the privacy notice)

Student memory between interviews, a history page and stored run manifests all need the tables in `docs/lovable-schema-request.md`. Do not send that request until the privacy notice (`src/routes/privacy.tsx`) says that transcripts and a short practice summary are stored, for how long, and how to delete them, because most users are under 18. Once it does, paste the message in that document.

The app already produces what those tables would hold: every interview logs an `interview.manifest` line and, after each student turn, an `interview.turn` line (labels only), so the code that saves them is a small follow-up once the tables exist.
