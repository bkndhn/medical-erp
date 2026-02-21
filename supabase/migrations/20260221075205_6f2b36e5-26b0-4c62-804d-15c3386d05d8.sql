
-- Super admin RLS: allow super_admin to see/manage ALL tenants and profiles
-- Add SELECT policy for super_admin on tenants
CREATE POLICY "Super admin can view all tenants" ON public.tenants
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can update all tenants" ON public.tenants
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can delete tenants" ON public.tenants
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can see all profiles
CREATE POLICY "Super admin can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can update all profiles" ON public.profiles
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin can manage all user_roles
CREATE POLICY "Super admin can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can insert all roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can update all roles" ON public.user_roles
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can delete all roles" ON public.user_roles
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Admin can view profiles in same tenant (for user management)
CREATE POLICY "Admin can view tenant profiles" ON public.profiles
FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Admin can update tenant profiles" ON public.profiles
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) AND tenant_id = get_user_tenant_id()
);

-- Function to check if tenant is active
CREATE OR REPLACE FUNCTION public.is_tenant_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT t.is_active FROM tenants t 
     JOIN profiles p ON p.tenant_id = t.id 
     WHERE p.user_id = auth.uid() 
     LIMIT 1),
    true
  )
$$;
