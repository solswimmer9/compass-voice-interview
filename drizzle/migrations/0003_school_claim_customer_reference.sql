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
INSERT INTO public.purchases(user_id,paddle_transaction_id,paddle_customer_id,product_id,price_id,status,environment,interviews_remaining,expires_at) VALUES(auth.uid(),'school_claim_'||gen_random_uuid()::text,'school_bundle_'||b.id::text,'school_student_interview','school_student_interview','completed',p_environment,1,b.expires_at) RETURNING id INTO v_purchase;
INSERT INTO public.school_claims(bundle_id,user_id,purchase_id) VALUES(b.id,auth.uid(),v_purchase);
UPDATE public.school_bundles SET interviews_remaining=interviews_remaining-1 WHERE id=b.id;
RETURN json_build_object('claimed',true,'remaining',b.interviews_remaining-1,'expiresAt',b.expires_at);
END; $$;