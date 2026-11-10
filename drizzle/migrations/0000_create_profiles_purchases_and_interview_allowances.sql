CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_transaction_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  environment text NOT NULL DEFAULT 'sandbox',
  interviews_remaining integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_environment_valid CHECK (environment IN ('sandbox', 'live')),
  CONSTRAINT purchases_interviews_remaining_valid CHECK (interviews_remaining >= 0)
);
CREATE INDEX purchases_user_environment_idx ON public.purchases(user_id, environment, created_at);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  environment text NOT NULL,
  feedback_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_sessions_environment_valid CHECK (environment IN ('sandbox', 'live'))
);
CREATE INDEX interview_sessions_user_idx ON public.interview_sessions(user_id, created_at);
CREATE UNIQUE INDEX one_free_interview_per_user_environment ON public.interview_sessions(user_id, environment) WHERE purchase_id IS NULL;
GRANT SELECT ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interview sessions" ON public.interview_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.consume_interview_credit(p_environment text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
  v_interview_id uuid;
  v_source text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid payment environment';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_environment));

  IF NOT EXISTS (
    SELECT 1 FROM public.interview_sessions
    WHERE user_id = v_user_id AND environment = p_environment AND purchase_id IS NULL
  ) THEN
    INSERT INTO public.interview_sessions (user_id, environment)
    VALUES (v_user_id, p_environment)
    RETURNING id INTO v_interview_id;
    v_source := 'free';
  ELSE
    SELECT id INTO v_purchase_id
    FROM public.purchases
    WHERE user_id = v_user_id
      AND environment = p_environment
      AND status = 'completed'
      AND interviews_remaining > 0
    ORDER BY created_at, id
    LIMIT 1
    FOR UPDATE;

    IF v_purchase_id IS NULL THEN
      RETURN json_build_object('allowed', false, 'remaining', 0);
    END IF;

    UPDATE public.purchases
    SET interviews_remaining = interviews_remaining - 1, updated_at = now()
    WHERE id = v_purchase_id;

    INSERT INTO public.interview_sessions (user_id, purchase_id, environment)
    VALUES (v_user_id, v_purchase_id, p_environment)
    RETURNING id INTO v_interview_id;
    v_source := 'purchase';
  END IF;

  RETURN json_build_object('allowed', true, 'interviewId', v_interview_id, 'source', v_source);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_interview_credit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_interview_credit(text) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_feedback(p_interview_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  UPDATE public.interview_sessions
  SET feedback_used = true
  WHERE id = p_interview_id AND user_id = v_user_id AND feedback_used = false
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_feedback(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_feedback(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_interview_credit(p_interview_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_purchase_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  SELECT purchase_id INTO v_purchase_id
  FROM public.interview_sessions
  WHERE id = p_interview_id AND user_id = v_user_id AND feedback_used = false
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  DELETE FROM public.interview_sessions WHERE id = p_interview_id;
  IF v_purchase_id IS NOT NULL THEN
    UPDATE public.purchases
    SET interviews_remaining = interviews_remaining + 1, updated_at = now()
    WHERE id = v_purchase_id;
  END IF;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.release_interview_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_interview_credit(uuid) TO service_role;