-- Clear stale 'My Salon' default and activate main admin subscription
UPDATE public.profiles
SET store_name = NULL
WHERE lower(coalesce(store_name,'')) IN ('my salon','salon','my business salon');

UPDATE public.profiles
SET subscription_status = 'active'
WHERE email = 'thariqajees522@gmail.com';
