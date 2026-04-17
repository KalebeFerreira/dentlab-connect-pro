-- Recreate the trigger that auto-creates profile and user_role on signup
-- This was missing, causing new users to get stuck in loading state

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for any existing users without one
INSERT INTO public.profiles (user_id, name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'name', u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- Backfill missing roles for any existing users without one
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, COALESCE((u.raw_user_meta_data->>'role')::app_role, 'clinic'::app_role)
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;