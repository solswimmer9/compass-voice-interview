CREATE OR REPLACE FUNCTION public.consume_interview_credit(p_environment text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid:=auth.uid(); v_purchase_id uuid; v_interview_id uuid; v_source text; v_free_limit integer; v_free_used integer;
BEGIN
IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_environment NOT IN ('sandbox','live') THEN RAISE EXCEPTION 'Invalid payment environment'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text||':'||p_environment));
v_free_limit := 2;
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
END; $function$;

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS tutor text,
  ADD COLUMN IF NOT EXISTS transcript jsonb,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;