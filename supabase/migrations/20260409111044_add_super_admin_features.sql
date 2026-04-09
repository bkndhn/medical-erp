-- Migration: add_super_admin_features

-- 1. Add max_items to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_items INT NOT NULL DEFAULT 500;

-- 2. Create system_settings table for master admin email
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults
INSERT INTO public.system_settings (key, value)
VALUES ('master_admin_email', 'bknqwe19@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- RLS for system_settings (only super_admin can manage)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System settings viewable by everyone" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "System settings editable by super admin" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Update handle_new_user to make master admin email super_admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master_email TEXT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Check if user is the master admin email
  SELECT value INTO master_email FROM public.system_settings WHERE key = 'master_admin_email';
  IF master_email IS NULL THEN
    master_email := 'bknqwe19@gmail.com';
  END IF;

  IF NEW.email = master_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
