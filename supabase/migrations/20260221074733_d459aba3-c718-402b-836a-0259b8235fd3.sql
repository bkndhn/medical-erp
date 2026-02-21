
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE
-- The current RESTRICTIVE policies block all access since there are no permissive policies

-- TENANTS
DROP POLICY IF EXISTS "Tenant owner can view" ON public.tenants;
DROP POLICY IF EXISTS "Tenant owner can update" ON public.tenants;
DROP POLICY IF EXISTS "Users can create own tenant" ON public.tenants;

CREATE POLICY "Tenant owner can view" ON public.tenants FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Tenant owner can update" ON public.tenants FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users can create own tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR tenant_id = get_user_tenant_id());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- USER_ROLES
DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;

CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()));
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- BRANCHES
DROP POLICY IF EXISTS "Tenant branches select" ON public.branches;
DROP POLICY IF EXISTS "Tenant branches insert" ON public.branches;
DROP POLICY IF EXISTS "Tenant branches update" ON public.branches;
DROP POLICY IF EXISTS "Tenant branches delete" ON public.branches;

CREATE POLICY "Tenant branches select" ON public.branches FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant branches insert" ON public.branches FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant branches update" ON public.branches FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant branches delete" ON public.branches FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- ITEMS
DROP POLICY IF EXISTS "Tenant items select" ON public.items;
DROP POLICY IF EXISTS "Tenant items insert" ON public.items;
DROP POLICY IF EXISTS "Tenant items update" ON public.items;
DROP POLICY IF EXISTS "Tenant items delete" ON public.items;

CREATE POLICY "Tenant items select" ON public.items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant items insert" ON public.items FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant items update" ON public.items FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant items delete" ON public.items FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- CATEGORIES
DROP POLICY IF EXISTS "Tenant categories select" ON public.categories;
DROP POLICY IF EXISTS "Tenant categories insert" ON public.categories;
DROP POLICY IF EXISTS "Tenant categories update" ON public.categories;
DROP POLICY IF EXISTS "Tenant categories delete" ON public.categories;

CREATE POLICY "Tenant categories select" ON public.categories FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant categories insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant categories update" ON public.categories FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant categories delete" ON public.categories FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "Tenant customers select" ON public.customers;
DROP POLICY IF EXISTS "Tenant customers insert" ON public.customers;
DROP POLICY IF EXISTS "Tenant customers update" ON public.customers;
DROP POLICY IF EXISTS "Tenant customers delete" ON public.customers;

CREATE POLICY "Tenant customers select" ON public.customers FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant customers update" ON public.customers FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant customers delete" ON public.customers FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- SUPPLIERS
DROP POLICY IF EXISTS "Tenant suppliers select" ON public.suppliers;
DROP POLICY IF EXISTS "Tenant suppliers insert" ON public.suppliers;
DROP POLICY IF EXISTS "Tenant suppliers update" ON public.suppliers;
DROP POLICY IF EXISTS "Tenant suppliers delete" ON public.suppliers;

CREATE POLICY "Tenant suppliers select" ON public.suppliers FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant suppliers insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant suppliers update" ON public.suppliers FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant suppliers delete" ON public.suppliers FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- SALES
DROP POLICY IF EXISTS "Tenant sales select" ON public.sales;
DROP POLICY IF EXISTS "Tenant sales insert" ON public.sales;
DROP POLICY IF EXISTS "Tenant sales update" ON public.sales;

CREATE POLICY "Tenant sales select" ON public.sales FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant sales insert" ON public.sales FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant sales update" ON public.sales FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());

-- SALE_ITEMS
DROP POLICY IF EXISTS "Tenant sale_items select" ON public.sale_items;
DROP POLICY IF EXISTS "Tenant sale_items insert" ON public.sale_items;

CREATE POLICY "Tenant sale_items select" ON public.sale_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.tenant_id = get_user_tenant_id()));
CREATE POLICY "Tenant sale_items insert" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.tenant_id = get_user_tenant_id()));

-- PURCHASES
DROP POLICY IF EXISTS "Tenant purchases select" ON public.purchases;
DROP POLICY IF EXISTS "Tenant purchases insert" ON public.purchases;
DROP POLICY IF EXISTS "Tenant purchases update" ON public.purchases;

CREATE POLICY "Tenant purchases select" ON public.purchases FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant purchases insert" ON public.purchases FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant purchases update" ON public.purchases FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());

-- PURCHASE_ITEMS
DROP POLICY IF EXISTS "Tenant purchase_items select" ON public.purchase_items;
DROP POLICY IF EXISTS "Tenant purchase_items insert" ON public.purchase_items;

CREATE POLICY "Tenant purchase_items select" ON public.purchase_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.tenant_id = get_user_tenant_id()));
CREATE POLICY "Tenant purchase_items insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM purchases WHERE purchases.id = purchase_items.purchase_id AND purchases.tenant_id = get_user_tenant_id()));

-- PAYMENTS
DROP POLICY IF EXISTS "Tenant payments select" ON public.payments;
DROP POLICY IF EXISTS "Tenant payments insert" ON public.payments;

CREATE POLICY "Tenant payments select" ON public.payments FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant payments insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

-- EXPENSES
DROP POLICY IF EXISTS "Tenant expenses select" ON public.expenses;
DROP POLICY IF EXISTS "Tenant expenses insert" ON public.expenses;
DROP POLICY IF EXISTS "Tenant expenses update" ON public.expenses;
DROP POLICY IF EXISTS "Tenant expenses delete" ON public.expenses;

CREATE POLICY "Tenant expenses select" ON public.expenses FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant expenses insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant expenses update" ON public.expenses FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant expenses delete" ON public.expenses FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- DEVICES
DROP POLICY IF EXISTS "Tenant devices select" ON public.devices;
DROP POLICY IF EXISTS "Tenant devices insert" ON public.devices;
DROP POLICY IF EXISTS "Tenant devices update" ON public.devices;
DROP POLICY IF EXISTS "Tenant devices delete" ON public.devices;

CREATE POLICY "Tenant devices select" ON public.devices FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant devices insert" ON public.devices FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant devices update" ON public.devices FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant devices delete" ON public.devices FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- GST_RATES
DROP POLICY IF EXISTS "Tenant gst_rates select" ON public.gst_rates;
DROP POLICY IF EXISTS "Tenant gst_rates insert" ON public.gst_rates;

CREATE POLICY "Tenant gst_rates select" ON public.gst_rates FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant gst_rates insert" ON public.gst_rates FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Tenant audit_logs select" ON public.audit_logs;
DROP POLICY IF EXISTS "Tenant audit_logs insert" ON public.audit_logs;

CREATE POLICY "Tenant audit_logs select" ON public.audit_logs FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant audit_logs insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
