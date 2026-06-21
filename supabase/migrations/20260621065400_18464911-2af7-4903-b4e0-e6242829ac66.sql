
-- 1. shifts: restrict to authenticated only
DROP POLICY IF EXISTS shifts_tenant_policy ON public.shifts;
CREATE POLICY shifts_tenant_policy ON public.shifts
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2. tenant_settings: admin/super_admin only for insert/update
DROP POLICY IF EXISTS tenant_settings_insert ON public.tenant_settings;
DROP POLICY IF EXISTS tenant_settings_update ON public.tenant_settings;
CREATE POLICY tenant_settings_insert ON public.tenant_settings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));
CREATE POLICY tenant_settings_update ON public.tenant_settings
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')))
  WITH CHECK (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));

-- 3. gst_rates: admin/super_admin update/delete
CREATE POLICY "Admin gst_rates update" ON public.gst_rates
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')))
  WITH CHECK (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));
CREATE POLICY "Admin gst_rates delete" ON public.gst_rates
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));

-- 4. profiles: restrict tenant-wide SELECT to self only; admins already covered by separate policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5. purchases: admin/super_admin delete
CREATE POLICY "Admin purchases delete" ON public.purchases
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')));
