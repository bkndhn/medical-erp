
-- Fix the permissive tenant insert policy to require owner_id = auth.uid()
DROP POLICY "Anyone can create tenant" ON public.tenants;
CREATE POLICY "Users can create own tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
