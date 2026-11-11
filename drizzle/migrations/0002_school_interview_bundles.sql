ALTER TABLE public.purchases ADD COLUMN expires_at timestamptz;
CREATE TABLE public.school_bundles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL UNIQUE REFERENCES public.purchases(id), owner_id uuid NOT NULL, code text NOT NULL UNIQUE DEFAULT upper(replace(gen_random_uuid()::text,'-','')), environment text NOT NULL CHECK(environment IN ('sandbox','live')), interviews_remaining integer NOT NULL DEFAULT 30 CHECK(interviews_remaining BETWEEN 0 AND 30), max_students integer NOT NULL DEFAULT 30 CHECK(max_students = 30), expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'completed', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.school_bundles TO authenticated;
GRANT ALL ON public.school_bundles TO service_role;
ALTER TABLE public.school_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_owner_read ON public.school_bundles FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE TABLE public.school_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bundle_id uuid NOT NULL REFERENCES public.school_bundles(id), user_id uuid NOT NULL, purchase_id uuid NOT NULL UNIQUE REFERENCES public.purchases(id), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.school_claims TO authenticated;
GRANT ALL ON public.school_claims TO service_role;
ALTER TABLE public.school_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_student_read ON public.school_claims FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.create_school_bundle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expiry timestamptz;
BEGIN
IF NEW.product_id='school_interview_bundle' AND NEW.status='completed' THEN
v_expiry := make_timestamptz(extract(year from now())::int,8,31,23,59,59,'Europe/London');
IF v_expiry <= now() THEN v_expiry := make_timestamptz(extract(year from now())::int+1,8,31,23,59,59,'Europe/London'); END IF;
INSERT INTO public.school_bundles(purchase_id,owner_id,environment,expires_at) VALUES(NEW.id,NEW.user_id,NEW.environment,v_expiry) ON CONFLICT(purchase_id) DO NOTHING;
END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER create_school_bundle AFTER INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.create_school_bundle();
CREATE OR REPLACE FUNCTION public.revoke_school_bundle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NEW.product_id='school_interview_bundle' AND NEW.status IN ('refunded','disputed') THEN
UPDATE public.school_bundles SET status=NEW.status, interviews_remaining=0 WHERE purchase_id=NEW.id;
UPDATE public.purchases SET status=NEW.status, interviews_remaining=0 WHERE id IN (SELECT c.purchase_id FROM public.school_claims c JOIN public.school_bundles b ON b.id=c.bundle_id WHERE b.purchase_id=NEW.id);
END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER revoke_school_bundle AFTER UPDATE OF status ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.revoke_school_bundle();
CREATE OR REPLACE FUNCTION public.claim_school_interview(p_code text,p_environment text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.school_bundles; v_purchase uuid; v_students integer;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid environment'; END IF;
SELECT * INTO b FROM public.school_bundles WHERE code=upper(trim(p_code)) AND environment=p_environment FOR UPDATE;
IF NOT FOUND OR b.status<>'completed' OR b.expires_at<=now() THEN RAISE EXCEPTION 'School code is unavailable or expired'; END IF;
IF b.interviews_remaining<=0 THEN RAISE EXCEPTION 'School bundle has no interviews left'; END IF;
SELECT count(DISTINCT user_id) INTO v_students FROM public.school_claims WHERE bundle_id=b.id;
IF v_students>=b.max_students AND NOT EXISTS(SELECT 1 FROM public.school_claims WHERE bundle_id=b.id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'School student limit reached'; END IF;
INSERT INTO public.purchases(user_id,paddle_transaction_id,product_id,price_id,status,environment,interviews_remaining,expires_at) VALUES(auth.uid(),'school_claim_'||gen_random_uuid()::text,'school_student_interview','school_student_interview','completed',p_environment,1,b.expires_at) RETURNING id INTO v_purchase;
INSERT INTO public.school_claims(bundle_id,user_id,purchase_id) VALUES(b.id,auth.uid(),v_purchase);
UPDATE public.school_bundles SET interviews_remaining=interviews_remaining-1 WHERE id=b.id;
RETURN json_build_object('claimed',true,'remaining',b.interviews_remaining-1,'expiresAt',b.expires_at);
END; $$;
REVOKE ALL ON FUNCTION public.claim_school_interview(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_school_interview(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.consume_interview_credit(p_environment text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_purchase_id uuid; v_interview_id uuid; v_source text;
BEGIN
IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid payment environment'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text||':'||p_environment));
IF NOT EXISTS(SELECT 1 FROM public.interview_sessions WHERE user_id=v_user_id AND environment=p_environment AND purchase_id IS NULL) THEN
INSERT INTO public.interview_sessions(user_id,environment) VALUES(v_user_id,p_environment) RETURNING id INTO v_interview_id; v_source:='free';
ELSE
SELECT id INTO v_purchase_id FROM public.purchases WHERE user_id=v_user_id AND environment=p_environment AND status='completed' AND interviews_remaining>0 AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at,id LIMIT 1 FOR UPDATE;
IF v_purchase_id IS NULL THEN RETURN json_build_object('allowed',false,'remaining',0); END IF;
UPDATE public.purchases SET interviews_remaining=interviews_remaining-1,updated_at=now() WHERE id=v_purchase_id;
INSERT INTO public.interview_sessions(user_id,purchase_id,environment) VALUES(v_user_id,v_purchase_id,p_environment) RETURNING id INTO v_interview_id; v_source:='purchase';
END IF;
RETURN json_build_object('allowed',true,'interviewId',v_interview_id,'source',v_source);
END; $$;
CREATE OR REPLACE FUNCTION public.release_interview_credit(p_interview_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_purchase_id uuid;
BEGIN
IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT purchase_id INTO v_purchase_id FROM public.interview_sessions WHERE id=p_interview_id AND user_id=v_user_id AND feedback_used=false FOR UPDATE;
IF NOT FOUND THEN RETURN false; END IF;
DELETE FROM public.interview_sessions WHERE id=p_interview_id;
IF v_purchase_id IS NOT NULL THEN UPDATE public.purchases SET interviews_remaining=interviews_remaining+1,updated_at=now() WHERE id=v_purchase_id AND status='completed' AND (expires_at IS NULL OR expires_at>now()); END IF;
RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.create_school_bundle(), public.revoke_school_bundle() FROM PUBLIC,anon,authenticated;