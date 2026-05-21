REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(uuid) TO authenticated;