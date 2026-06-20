ALTER FUNCTION public.update_customer_reward_points(uuid, numeric, numeric) SET search_path = public;

REVOKE ALL ON FUNCTION public.increment_batch_sold(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_customer_reward_points(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_tenant_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_active() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.increment_batch_sold(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_customer_reward_points(uuid, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_active() TO authenticated, service_role;