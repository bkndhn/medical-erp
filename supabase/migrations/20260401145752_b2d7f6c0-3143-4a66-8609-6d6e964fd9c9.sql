ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS supplier_id uuid NULL;

ALTER TABLE public.items
ADD CONSTRAINT items_supplier_id_fkey
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_items
ADD COLUMN IF NOT EXISTS purchase_unit text NOT NULL DEFAULT 'strip';

ALTER TABLE public.purchase_items
DROP CONSTRAINT IF EXISTS purchase_items_purchase_unit_check;

ALTER TABLE public.purchase_items
ADD CONSTRAINT purchase_items_purchase_unit_check
CHECK (purchase_unit IN ('strip', 'loose'));

CREATE INDEX IF NOT EXISTS idx_items_supplier_id ON public.items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_unit ON public.purchase_items(purchase_unit);