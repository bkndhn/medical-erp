
-- Branches: extra business detail fields
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS drug_license   TEXT,
  ADD COLUMN IF NOT EXISTS fssai_number   TEXT,
  ADD COLUMN IF NOT EXISTS tagline        TEXT,
  ADD COLUMN IF NOT EXISTS receipt_header TEXT,
  ADD COLUMN IF NOT EXISTS receipt_footer TEXT;

-- Item batches: remaining/sold tracking
ALTER TABLE public.item_batches
  ADD COLUMN IF NOT EXISTS quantity_remaining NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_sold      NUMERIC NOT NULL DEFAULT 0;

-- Initialize remaining from quantity_in - quantity_out where applicable
UPDATE public.item_batches
   SET quantity_remaining = GREATEST(COALESCE(quantity_in,0) - COALESCE(quantity_out,0), 0)
 WHERE quantity_remaining = 0;

-- Customers: loyalty points
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS reward_points NUMERIC NOT NULL DEFAULT 0;

-- Purchase items: tenant scoping for RLS-aware inserts from Reorder page
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.purchase_items pi
   SET tenant_id = p.tenant_id
  FROM public.purchases p
 WHERE pi.purchase_id = p.id AND pi.tenant_id IS NULL;

-- Sale items: batch reference so we can attribute stock decrements
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.item_batches(id) ON DELETE SET NULL;

-- RPC: atomically increment quantity_sold / decrement quantity_remaining on a batch
CREATE OR REPLACE FUNCTION public.increment_batch_sold(
  p_batch_id UUID,
  p_qty NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.item_batches
     SET quantity_sold      = COALESCE(quantity_sold, 0)      + p_qty,
         quantity_remaining = GREATEST(COALESCE(quantity_remaining, 0) - p_qty, 0)
   WHERE id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_batch_sold(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_batch_sold(UUID, NUMERIC) TO authenticated, service_role;
