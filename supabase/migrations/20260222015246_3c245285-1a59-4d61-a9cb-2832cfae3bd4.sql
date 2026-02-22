
-- User page access for custom per-user page permissions (toggle-based)
CREATE TABLE public.user_page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

-- Admins can manage page access for their tenant
CREATE POLICY "Admin manage page access" ON public.user_page_access
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = get_user_tenant_id())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) AND tenant_id = get_user_tenant_id())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Users can view their own page access
CREATE POLICY "Users view own page access" ON public.user_page_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Add update trigger
CREATE TRIGGER update_user_page_access_updated_at
  BEFORE UPDATE ON public.user_page_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Allow payments delete and update for split payment management
CREATE POLICY "Tenant payments delete" ON public.payments
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant payments update" ON public.payments
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());
