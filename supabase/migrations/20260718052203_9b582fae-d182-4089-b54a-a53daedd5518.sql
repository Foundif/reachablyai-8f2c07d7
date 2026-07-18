-- Ensure trigger for handle_new_user exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profile + personal workspace for any auth user missing them
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (u.id, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', ''))
    ON CONFLICT (user_id) DO NOTHING;
    PERFORM public.ensure_personal_workspace(u.id, u.email);
  END LOOP;
END $$;