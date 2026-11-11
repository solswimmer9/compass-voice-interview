# Database security request for Lovable

The database is managed by Lovable (see `AGENTS.md`), so these changes are written as a request
to paste into the Lovable editor. Nothing here has been applied yet.

## In plain English

- **Free interviews can be refunded by anyone signed in.** The database lets any signed-in
  account call the "give my interview credit back" function directly from the browser. After a
  real interview (before asking for feedback) a user can call it and get the credit back, and for
  the free interview this resets the free allowance, so the free interview becomes unlimited.
  Fix: only the server may call it.
- **Failed feedback is lost.** When the AI fails to produce feedback (for example the AI account
  is out of credit), the interview's one feedback is still marked used. The app code is ready to
  give it back as soon as the database has a function for it.
- **One student can use up a whole school bundle.** A school code can be claimed again and
  again by the same student, so one person can take all 30 interviews. Fix: limit each student.
- **Optional: keep transcripts on the server** so feedback is based on what was actually said,
  not on text the browser sends. See also `docs/lovable-schema-request.md`.

The app code already copes with every change below being applied or not applied yet.

## Message to paste

> Please apply the following database changes exactly. Keep all other tables, functions,
> policies and credit rules as they are.
>
> **1. Make `release_interview_credit` server-only and take the user explicitly.** It currently
> uses `auth.uid()` and is executable by `authenticated`, so users can refund their own credits
> after an interview. Replace it with a version that takes the user id and can only be run by
> `service_role`:
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
>     WHERE id = v_purchase_id AND status = 'completed' AND (expires_at IS NULL OR expires_at > now());
>   END IF;
>   RETURN true;
> END; $$;
>
> REVOKE ALL ON FUNCTION public.release_interview_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
> GRANT EXECUTE ON FUNCTION public.release_interview_credit(uuid, uuid) TO service_role;
> ```
>
> (The 10-minute window is a backstop: the server only releases a credit when the voice call
> failed to start, which happens within seconds.)
>
> **2. Add `release_feedback`, server-only**, to undo `consume_feedback` when feedback generation
> fails:
>
> ```sql
> CREATE FUNCTION public.release_feedback(p_interview_id uuid, p_user_id uuid)
> RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
> DECLARE v_id uuid;
> BEGIN
>   IF p_user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
>   UPDATE public.interview_sessions SET feedback_used = false
>   WHERE id = p_interview_id AND user_id = p_user_id AND feedback_used = true
>   RETURNING id INTO v_id;
>   RETURN v_id IS NOT NULL;
> END; $$;
>
> REVOKE ALL ON FUNCTION public.release_feedback(uuid, uuid) FROM PUBLIC, anon, authenticated;
> GRANT EXECUTE ON FUNCTION public.release_feedback(uuid, uuid) TO service_role;
> ```
>
> **3. Limit each student to one claim per school bundle.** Replace `claim_school_interview`
> (latest version from migration 0003) with this version; the only change is the new per-student
> check, plus a unique index so two simultaneous claims cannot both succeed:
>
> ```sql
> CREATE UNIQUE INDEX IF NOT EXISTS school_claims_one_per_student
>   ON public.school_claims (bundle_id, user_id);
>
> CREATE OR REPLACE FUNCTION public.claim_school_interview(p_code text, p_environment text)
> RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
> DECLARE b public.school_bundles; v_purchase uuid; v_students integer;
> BEGIN
>   IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
>   IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
>   SELECT * INTO b FROM public.school_bundles
>   WHERE code = upper(trim(p_code)) AND environment = p_environment FOR UPDATE;
>   IF NOT FOUND OR b.status <> 'completed' OR b.expires_at <= now() THEN
>     RAISE EXCEPTION 'School code is unavailable or expired';
>   END IF;
>   IF b.interviews_remaining <= 0 THEN RAISE EXCEPTION 'School bundle has no interviews left'; END IF;
>   IF EXISTS (SELECT 1 FROM public.school_claims WHERE bundle_id = b.id AND user_id = auth.uid()) THEN
>     RAISE EXCEPTION 'You have already claimed your interview from this school code';
>   END IF;
>   SELECT count(DISTINCT user_id) INTO v_students FROM public.school_claims WHERE bundle_id = b.id;
>   IF v_students >= b.max_students THEN RAISE EXCEPTION 'School student limit reached'; END IF;
>   INSERT INTO public.purchases(user_id, paddle_transaction_id, paddle_customer_id, product_id, price_id,
>     status, environment, interviews_remaining, expires_at)
>   VALUES (auth.uid(), 'school_claim_' || gen_random_uuid()::text, 'school_bundle_' || b.id::text,
>     'school_student_interview', 'school_student_interview', 'completed', p_environment, 1, b.expires_at)
>   RETURNING id INTO v_purchase;
>   INSERT INTO public.school_claims(bundle_id, user_id, purchase_id) VALUES (b.id, auth.uid(), v_purchase);
>   UPDATE public.school_bundles SET interviews_remaining = interviews_remaining - 1 WHERE id = b.id;
>   RETURN json_build_object('claimed', true, 'remaining', b.interviews_remaining - 1, 'expiresAt', b.expires_at);
> END; $$;
>
> REVOKE ALL ON FUNCTION public.claim_school_interview(text, text) FROM PUBLIC, anon;
> GRANT EXECUTE ON FUNCTION public.claim_school_interview(text, text) TO authenticated;
> ```
>
> Before creating the unique index, check for existing duplicate `(bundle_id, user_id)` rows in
> `school_claims`; if there are any, keep them and create the index only after telling me.
>
> **4. Optional: server-side transcripts.** Add a nullable `transcript jsonb` column to
> `interview_sessions` and a function `save_interview_transcript(p_interview_id uuid,
p_user_id uuid, p_transcript jsonb) RETURNS boolean` (security definer, `search_path =
public`) that sets `transcript` on that user's row only while it is still null. Grant it to
> `service_role` only, not `authenticated`, so only the voice server can write what was said.

## Why the other credit functions are fine as they are

`consume_interview_credit` and `consume_feedback` are executable by `authenticated`. That is
acceptable: they only ever take the caller's own credit or feedback (they use `auth.uid()`), so
a user calling them directly can only use up their own allowance. They give nothing away.
Once item 1 is done, a credit taken by calling `consume_interview_credit` directly cannot be
given back by the user, so there is nothing to gain. (If you prefer, they could also be made
server-only later, but the app's voice server and feedback route currently call them with the
user's own sign-in, so that would need a code change first.)

## Code changes once Lovable has applied this

- **Item 1 (needed straight away, or failed calls will no longer refund):** in
  `src/lib/live-relay.server.ts`, `releaseUnusedCredit` must call the function with the
  service-role client and the user id that the server already checked:

  ```ts
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("release_interview_credit", {
    p_interview_id: credit.id,
    p_user_id: credit.userId, // store auth.user.id in interviewCredit in authorizeStart
  });
  ```

  and `authorizeStart` sets `interviewCredit = { id, supabase: auth.supabase, userId: auth.user.id }`.
  Then regenerate the Supabase types.

- **Item 2:** nothing. `src/lib/assess.server.ts` already calls `release_feedback` with the
  service-role client and quietly does nothing until it exists.
- **Item 3:** nothing. The schools page already shows the database's error message.
- **Item 4:** the relay would save its transcript at the end of the call, and the feedback route
  would read it instead of the browser's copy.

## Checks after applying

- Signed in as a normal user, calling `release_interview_credit` from the browser console fails
  with a permission error.
- A voice call that fails to start still gives the credit back (relay uses the service role).
- Claiming the same school code twice with one account fails the second time; a second student
  can still claim.
