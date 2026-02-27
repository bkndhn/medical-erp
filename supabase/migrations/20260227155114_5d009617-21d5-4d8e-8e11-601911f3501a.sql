CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  code text NOT NULL,
  icon text DEFAULT '💳',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant payment_methods select" ON public.payment_methods FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant payment_methods insert" ON public.payment_methods FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant payment_methods update" ON public.payment_methods FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant payment_methods delete" ON public.payment_methods FOR DELETE USING (tenant_id = get_user_tenant_id());