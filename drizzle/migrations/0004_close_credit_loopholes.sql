-- 1. Server-only interview credit release
REVOKE EXECUTE ON FUNCTION public.release_interview_credit(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.release_interview_credit(uuid);

CREATE FUNCTION public.release_interview_credit(p_interview_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_purchase_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  SELECT purchase_id INTO v_purchase_id FROM public.interview_sessions
  WHERE id = p_interview_id AND user_id = p_user_id AND feedback_used = false
    AND created_at > now() - interval '10 minutes'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.interview_sessions WHERE id = p_interview_id;
  IF v_purchase_id IS NOT NULL THEN
    UPDATE public.purchases SET interviews_remaining = interviews_remaining + 1, updated_at = now()
    WHERE id = v_purchase_id AND status = 'completed' AND (expires_at IS NULL OR expires_at > now());
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.release_interview_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_interview_credit(uuid, uuid) TO service_role;

-- 2. Refund/dispute notes that may arrive before the purchase is recorded
CREATE TABLE public.payment_revocations (
  checkout_session_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  status text NOT NULL CHECK (status IN ('refunded','disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (checkout_session_id, environment)
);
GRANT ALL ON public.payment_revocations TO service_role;
ALTER TABLE public.payment_revocations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.revoke_purchase(p_session_id text, p_environment text, p_status text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
  IF p_status NOT IN ('refunded','disputed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('purchase:' || p_session_id || ':' || p_environment));
  INSERT INTO public.payment_revocations(checkout_session_id, environment, status)
  VALUES (p_session_id, p_environment, p_status)
  ON CONFLICT (checkout_session_id, environment) DO UPDATE SET status = EXCLUDED.status;
  UPDATE public.purchases SET interviews_remaining = 0, status = p_status, updated_at = now()
  WHERE paddle_transaction_id = p_session_id AND environment = p_environment;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.revoke_purchase(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_purchase(text, text, text) TO service_role;

CREATE FUNCTION public.apply_early_revocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('purchase:' || NEW.paddle_transaction_id || ':' || NEW.environment));
  SELECT status INTO v_status FROM public.payment_revocations
  WHERE checkout_session_id = NEW.paddle_transaction_id AND environment = NEW.environment;
  IF FOUND THEN
    NEW.status := v_status;
    NEW.interviews_remaining := 0;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.apply_early_revocation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER apply_early_revocation BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_early_revocation();

-- 3. One claim per student per school code
CREATE UNIQUE INDEX school_claims_one_per_student ON public.school_claims(bundle_id, user_id);

CREATE OR REPLACE FUNCTION public.claim_school_interview(p_code text,p_environment text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.school_bundles; v_purchase uuid; v_students integer;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
SELECT * INTO b FROM public.school_bundles WHERE code=upper(trim(p_code)) AND environment=p_environment FOR UPDATE;
IF NOT FOUND OR b.status<>'completed' OR b.expires_at<=now() THEN RAISE EXCEPTION 'School code is unavailable or expired'; END IF;
IF EXISTS(SELECT 1 FROM public.school_claims WHERE bundle_id=b.id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'You have already claimed your interview from this school code'; END IF;
IF b.interviews_remaining<=0 THEN RAISE EXCEPTION 'School bundle has no interviews left'; END IF;
SELECT count(DISTINCT user_id) INTO v_students FROM public.school_claims WHERE bundle_id=b.id;
IF v_students>=b.max_students THEN RAISE EXCEPTION 'School student limit reached'; END IF;
INSERT INTO public.purchases(user_id,paddle_transaction_id,paddle_customer_id,product_id,price_id,status,environment,interviews_remaining,expires_at) VALUES(auth.uid(),'school_claim_'||gen_random_uuid()::text,'school_bundle_'||b.id::text,'school_student_interview','school_student_interview','completed',p_environment,1,b.expires_at) RETURNING id INTO v_purchase;
INSERT INTO public.school_claims(bundle_id,user_id,purchase_id) VALUES(b.id,auth.uid(),v_purchase);
UPDATE public.school_bundles SET interviews_remaining=interviews_remaining-1 WHERE id=b.id;
RETURN json_build_object('claimed',true,'remaining',b.interviews_remaining-1,'expiresAt',b.expires_at);
END; $$;
REVOKE ALL ON FUNCTION public.claim_school_interview(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_school_interview(text,text) TO authenticated;

-- 4. Guests (anonymous accounts) get 2 free interviews; signed-in accounts keep 1
DROP INDEX public.one_free_interview_per_user_environment;
CREATE INDEX interview_sessions_free_idx ON public.interview_sessions(user_id, environment) WHERE purchase_id IS NULL;

CREATE OR REPLACE FUNCTION public.consume_interview_credit(p_environment text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_purchase_id uuid; v_interview_id uuid; v_source text; v_free_limit integer; v_free_used integer;
BEGIN
IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid payment environment'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text||':'||p_environment));
v_free_limit := CASE WHEN coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN 2 ELSE 1 END;
SELECT count(*) INTO v_free_used FROM public.interview_sessions WHERE user_id=v_user_id AND environment=p_environment AND purchase_id IS NULL;
IF v_free_used < v_free_limit THEN
INSERT INTO public.interview_sessions(user_id,environment) VALUES(v_user_id,p_environment) RETURNING id INTO v_interview_id; v_source:='free';
ELSE
SELECT id INTO v_purchase_id FROM public.purchases WHERE user_id=v_user_id AND environment=p_environment AND status='completed' AND interviews_remaining>0 AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
IF v_purchase_id IS NULL THEN RETURN json_build_object('allowed',false,'remaining',0); END IF;
UPDATE public.purchases SET interviews_remaining=interviews_remaining-1,updated_at=now() WHERE id=v_purchase_id;
INSERT INTO public.interview_sessions(user_id,purchase_id,environment) VALUES(v_user_id,v_purchase_id,p_environment) RETURNING id INTO v_interview_id; v_source:='purchase';
END IF;
RETURN json_build_object('allowed',true,'interviewId',v_interview_id,'source',v_source);
END; $$;
REVOKE ALL ON FUNCTION public.consume_interview_credit(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_interview_credit(text) TO authenticated;