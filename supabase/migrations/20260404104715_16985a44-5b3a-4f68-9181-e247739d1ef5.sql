
-- Customer Ledger table
CREATE TABLE public.customer_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('sale', 'payment', 'return', 'adjustment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant customer_ledger select" ON public.customer_ledger FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant customer_ledger insert" ON public.customer_ledger FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_customer_ledger_customer ON public.customer_ledger(customer_id);
CREATE INDEX idx_customer_ledger_tenant ON public.customer_ledger(tenant_id);

-- Purchase Returns table
CREATE TABLE public.purchase_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  supplier_id UUID,
  purchase_id UUID,
  return_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant purchase_returns select" ON public.purchase_returns FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant purchase_returns insert" ON public.purchase_returns FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant purchase_returns update" ON public.purchase_returns FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_purchase_returns_tenant ON public.purchase_returns(tenant_id);
CREATE INDEX idx_purchase_returns_supplier ON public.purchase_returns(supplier_id);

-- Purchase Return Items table
CREATE TABLE public.purchase_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  reason TEXT
);

ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant purchase_return_items select" ON public.purchase_return_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM purchase_returns WHERE purchase_returns.id = purchase_return_items.return_id AND purchase_returns.tenant_id = get_user_tenant_id()));
CREATE POLICY "Tenant purchase_return_items insert" ON public.purchase_return_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM purchase_returns WHERE purchase_returns.id = purchase_return_items.return_id AND purchase_returns.tenant_id = get_user_tenant_id()));

-- Bill-wise profit: add cost_total to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cost_total NUMERIC DEFAULT 0;
