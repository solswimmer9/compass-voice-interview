# Lovable requests, 19 November 2026

The database is managed by Lovable (see `AGENTS.md`), so these are written as messages to paste into the Lovable editor. Nothing here has been applied. Send them in this order, one at a time, and check each one before the next.

## 1. Close the free-interview refund hole (applied 19 November 2026)

Any signed-in account, including the new guest accounts, can call `release_interview_credit` directly from the browser and get an interview's credit back. For a free interview this also resets the free allowance, so free interviews become unlimited.

A time limit on its own does not close this: a student can call it 10 seconds into an interview, get the credit back, and carry on talking for the full interview. So only the server may call it. The app already does this (`releaseInterviewCredit` in `src/lib/live-relay.server.ts`): it calls the new server-only version below with the service role, and falls back to the old call only while the new one does not exist yet, so refunds for calls that fail to start keep working before and after the change.

If the earlier 90-second version of this request was already applied, send this one anyway: it replaces the function.

> Please apply these database changes exactly. Keep all other tables, functions, policies and credit rules as they are.
>
> Make `release_interview_credit` server-only and have it take the user explicitly. It currently uses `auth.uid()` and is executable by `authenticated`, so users can refund their own credits during or after an interview. Replace it with a version that takes the user id and can only be run by `service_role`:
>
> ```sql
> REVOKE EXECUTE ON FUNCTION public.release_interview_credit(uuid) FROM PUBLIC, anon, authenticated;
> DROP FUNCTION public.release_interview_credit(uuid);
>
> CREATE FUNCTION public.release_interview_credit(p_interview_id uuid, p_user_id uuid)
> RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
> DECLARE v_purchase_id uuid;
> BEGIN
>   IF p_user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
>   SELECT purchase_id INTO v_purchase_id FROM public.interview_sessions
>   WHERE id = p_interview_id AND user_id = p_user_id AND feedback_used = false
>     AND created_at > now() - interval '10 minutes'
>   FOR UPDATE;
>   IF NOT FOUND THEN RETURN false; END IF;
>   DELETE FROM public.interview_sessions WHERE id = p_interview_id;
>   IF v_purchase_id IS NOT NULL THEN
>     UPDATE public.purchases SET interviews_remaining = interviews_remaining + 1, updated_at = now()
>     WHERE id = v_purchase_id;
>   END IF;
>   RETURN true;
> END; $$;
>
> REVOKE ALL ON FUNCTION public.release_interview_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
> GRANT EXECUTE ON FUNCTION public.release_interview_credit(uuid, uuid) TO service_role;
> ```
>
> Then regenerate the Supabase types.

The 10-minute window is a backstop only: the server refunds a call only when it saw it fail to start, with no student speech, within 20 seconds (`MIN_BILLABLE_SESSION_MS`).

Check afterwards:

- In the browser console of a signed-in account, calling `release_interview_credit` now fails with a permission or "function not found" error.
- Start an interview, talk for two minutes, end it, and confirm your remaining interview count did not go back up.
- Start an interview and close the tab before the tutor speaks: the credit should come back (server log has no "could not be restored" error).

## 2. Two free tries for guests (database change applied 19 November 2026)

The app now lets visitors start as an anonymous guest. Until this change, a guest gets one try, not two.

First, turn on anonymous sign-ins in Cloud → Users → Auth settings. Then:

> Update `consume_interview_credit` so anonymous users (`auth.jwt()->>'is_anonymous' = 'true'`) get 2 free interviews instead of 1: they may create a free session while they have fewer than 2 sessions with `purchase_id IS NULL` in that environment. If the unique index `one_free_interview_per_user_environment` prevents a second free row, exclude anonymous users' rows from it or replace it with the count check. Keep 1 free interview for normal accounts and keep every other rule the same.

Check afterwards: in a private window, do two guest interviews; the third should ask you to sign in.

## 3. Saved transcripts and student memory (after the privacy notice)

Student memory between interviews, a history page and stored run manifests all need the tables in `docs/lovable-schema-request.md`. Do not send that request until the privacy notice (`src/routes/privacy.tsx`) says that transcripts and a short practice summary are stored, for how long, and how to delete them, because most users are under 18. Once it does, paste the message in that document.

The app already produces what those tables would hold: every interview logs an `interview.manifest` line and, after each student turn, an `interview.turn` line (labels only), so the code that saves them is a small follow-up once the tables exist.
