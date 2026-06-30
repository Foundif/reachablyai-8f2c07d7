UPDATE public.super_admins
SET username = 'tntc45office@gmail.com',
    password_hash = 'TN45@dmin@2026@',
    session_token = NULL,
    updated_at = now()
WHERE username = 'thariqajees522@gmail.com'
   OR id = (SELECT id FROM public.super_admins ORDER BY created_at ASC LIMIT 1);

-- Safety: if no row was updated, insert
INSERT INTO public.super_admins (username, password_hash)
SELECT 'tntc45office@gmail.com', 'TN45@dmin@2026@'
WHERE NOT EXISTS (SELECT 1 FROM public.super_admins WHERE username = 'tntc45office@gmail.com');