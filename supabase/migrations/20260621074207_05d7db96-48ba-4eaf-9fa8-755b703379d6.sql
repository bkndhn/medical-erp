
-- Add missing batch tracking columns to sale_items (needed by POS insert; absence causes silent insert failure → empty bills)
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS batch_number TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Ensure UPDATE/DELETE policies exist for sale_items (returns/edits)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='Tenant sale_items update' AND polrelid='public.sale_items'::regclass) THEN
    CREATE POLICY "Tenant sale_items update" ON public.sale_items FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.tenant_id = public.get_user_tenant_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.tenant_id = public.get_user_tenant_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname='Tenant sale_items delete' AND polrelid='public.sale_items'::regclass) THEN
    CREATE POLICY "Tenant sale_items delete" ON public.sale_items FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.tenant_id = public.get_user_tenant_id()));
  END IF;
END $$;
