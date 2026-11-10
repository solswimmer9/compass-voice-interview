REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_interview_credit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_interview_credit(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_feedback(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_feedback(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_interview_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_interview_credit(uuid) FROM anon;