
-- =============================================
-- MULTI-TENANT ERP SAAS DATABASE SCHEMA
-- =============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'cashier', 'staff');
CREATE TYPE public.industry_type AS ENUM ('grocery', 'textile', 'medical', 'fruit', 'custom');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'card', 'upi', 'credit', 'split');
CREATE TYPE public.sale_status AS ENUM ('completed', 'held', 'cancelled', 'refunded');
CREATE TYPE public.purchase_status AS ENUM ('pending', 'received', 'partial', 'cancelled');
CREATE TYPE public.expense_type AS ENUM ('rent', 'salary', 'utility', 'transport', 'other');
CREATE TYPE public.device_status AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'business', 'enterprise');

-- 2. TENANTS
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry industry_type NOT NULL DEFAULT 'grocery',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription subscription_plan NOT NULL DEFAULT 'free',
  max_branches INT NOT NULL DEFAULT 1,
  max_devices INT NOT NULL DEFAULT 2,
  max_users INT NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. BRANCHES
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. USER ROLES (separate table as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  UNIQUE(user_id, role)
);

-- 6. DEVICES
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  device_identifier TEXT,
  status device_status NOT NULL DEFAULT 'active',
  last_active_at TIMESTAMPTZ,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ITEMS / PRODUCTS
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  mrp NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  gst_rate NUMERIC(5,2) DEFAULT 0,
  hsn_code TEXT,
  stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12,3) DEFAULT 10,
  batch_number TEXT,
  expiry_date DATE,
  -- Textile fields
  size TEXT,
  color TEXT,
  material TEXT,
  -- Medical fields
  composition TEXT,
  manufacturer TEXT,
  -- Fruit fields
  weight_per_unit NUMERIC(10,3),
  is_weighable BOOLEAN DEFAULT false,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  outstanding NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  outstanding NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  amount_paid NUMERIC(12,2) DEFAULT 0,
  change_amount NUMERIC(12,2) DEFAULT 0,
  status sale_status NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. SALE ITEMS
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 13. PURCHASES
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status purchase_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. PURCHASE ITEMS
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 15. PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category expense_type NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_to TEXT,
  payment_mode payment_mode DEFAULT 'cash',
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. GST RATES
CREATE TABLE public.gst_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  hsn_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Get tenant_id for current user
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES (tenant-isolated)
-- =============================================

-- TENANTS: owner can manage
CREATE POLICY "Tenant owner can view" ON public.tenants FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Tenant owner can update" ON public.tenants FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Anyone can create tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);

-- PROFILES: users see own, admins see tenant
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR tenant_id = public.get_user_tenant_id());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- USER ROLES: viewable by same tenant, manageable by admins
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- TENANT-SCOPED TABLES: tenant members can CRUD
-- Branches
CREATE POLICY "Tenant branches select" ON public.branches FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant branches insert" ON public.branches FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant branches update" ON public.branches FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant branches delete" ON public.branches FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Devices
CREATE POLICY "Tenant devices select" ON public.devices FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant devices insert" ON public.devices FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant devices update" ON public.devices FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant devices delete" ON public.devices FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Categories
CREATE POLICY "Tenant categories select" ON public.categories FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant categories insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant categories update" ON public.categories FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant categories delete" ON public.categories FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Items
CREATE POLICY "Tenant items select" ON public.items FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant items insert" ON public.items FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant items update" ON public.items FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant items delete" ON public.items FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Customers
CREATE POLICY "Tenant customers select" ON public.customers FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant customers update" ON public.customers FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant customers delete" ON public.customers FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Suppliers
CREATE POLICY "Tenant suppliers select" ON public.suppliers FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant suppliers insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant suppliers update" ON public.suppliers FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant suppliers delete" ON public.suppliers FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Sales
CREATE POLICY "Tenant sales select" ON public.sales FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant sales insert" ON public.sales FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant sales update" ON public.sales FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Sale Items (via sale's tenant)
CREATE POLICY "Tenant sale_items select" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Tenant sale_items insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.tenant_id = public.get_user_tenant_id()));

-- Purchases
CREATE POLICY "Tenant purchases select" ON public.purchases FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant purchases insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant purchases update" ON public.purchases FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Purchase Items
CREATE POLICY "Tenant purchase_items select" ON public.purchase_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Tenant purchase_items insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.tenant_id = public.get_user_tenant_id()));

-- Payments
CREATE POLICY "Tenant payments select" ON public.payments FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant payments insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Expenses
CREATE POLICY "Tenant expenses select" ON public.expenses FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant expenses insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant expenses update" ON public.expenses FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant expenses delete" ON public.expenses FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- GST Rates
CREATE POLICY "Tenant gst_rates select" ON public.gst_rates FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant gst_rates insert" ON public.gst_rates FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Audit Logs
CREATE POLICY "Tenant audit_logs select" ON public.audit_logs FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant audit_logs insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_branches_tenant ON public.branches(tenant_id);
CREATE INDEX idx_items_tenant ON public.items(tenant_id);
CREATE INDEX idx_items_barcode ON public.items(barcode);
CREATE INDEX idx_items_sku ON public.items(sku);
CREATE INDEX idx_items_category ON public.items(category_id);
CREATE INDEX idx_sales_tenant ON public.sales(tenant_id);
CREATE INDEX idx_sales_branch ON public.sales(branch_id);
CREATE INDEX idx_sales_created ON public.sales(created_at);
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_purchases_tenant ON public.purchases(tenant_id);
CREATE INDEX idx_expenses_tenant ON public.expenses(tenant_id);
CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_devices_tenant ON public.devices(tenant_id);
CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
