
-- Active sessions tracking table
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_name text DEFAULT 'Unknown Device',
  ip_address text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Admins/super admins can manage sessions in their tenant
CREATE POLICY "Admin view tenant sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id() OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Users manage own session" ON public.active_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin delete tenant sessions" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') AND tenant_id = get_user_tenant_id()) 
    OR has_role(auth.uid(), 'super_admin')
  );

-- Add max_sessions column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_sessions integer NOT NULL DEFAULT 5;
