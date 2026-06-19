
-- 1) Create trigger on auth.users so new sign-ups auto-create profile + assign super_admin to master email
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill: ensure the master admin email has super_admin role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE u.email = COALESCE(
  (SELECT value FROM public.system_settings WHERE key = 'master_admin_email'),
  'bknqwe19@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Ensure every existing auth user has a profile row
INSERT INTO public.profiles (user_id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;
