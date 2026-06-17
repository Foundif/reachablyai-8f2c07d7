
ALTER TABLE public.tn_bookings
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.tn_bookings_status_timeline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_history := jsonb_build_array(
      jsonb_build_object('status', COALESCE(NEW.status,'draft'), 'at', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note', 'created')
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := COALESCE(OLD.status_history,'[]'::jsonb) ||
      jsonb_build_array(
        jsonb_build_object('status', NEW.status, 'at', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'note', COALESCE(NEW.notes,''))
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tn_bookings_status_timeline_trg ON public.tn_bookings;
CREATE TRIGGER tn_bookings_status_timeline_trg
BEFORE INSERT OR UPDATE ON public.tn_bookings
FOR EACH ROW EXECUTE FUNCTION public.tn_bookings_status_timeline();

-- When a booking is marked paid/confirmed/completed, auto-complete its pending payment
CREATE OR REPLACE FUNCTION public.tn_bookings_sync_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid','confirmed','completed') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.tn_payments
       SET status = 'completed',
           verified_at = COALESCE(verified_at, now())
     WHERE booking_id = NEW.id
       AND status IN ('pending','verified');

    IF NOT FOUND AND COALESCE(NEW.advance_amount,0) > 0 THEN
      INSERT INTO public.tn_payments(user_id, booking_id, amount, method, status, verified_at)
      VALUES (NEW.user_id, NEW.id, NEW.advance_amount, 'manual', 'completed', now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tn_bookings_sync_payment_trg ON public.tn_bookings;
CREATE TRIGGER tn_bookings_sync_payment_trg
AFTER UPDATE ON public.tn_bookings
FOR EACH ROW EXECUTE FUNCTION public.tn_bookings_sync_payment();

-- Backfill: any historical paid/confirmed/completed bookings without a completed payment
INSERT INTO public.tn_payments(user_id, booking_id, amount, method, status, verified_at)
SELECT b.user_id, b.id, COALESCE(b.advance_amount, b.price, 0), 'manual', 'completed', now()
FROM public.tn_bookings b
LEFT JOIN public.tn_payments p ON p.booking_id = b.id
WHERE b.status IN ('paid','confirmed','completed')
  AND p.id IS NULL
  AND COALESCE(b.advance_amount, b.price, 0) > 0;

UPDATE public.tn_payments p
   SET status='completed', verified_at = COALESCE(verified_at, now())
  FROM public.tn_bookings b
 WHERE p.booking_id = b.id
   AND b.status IN ('paid','confirmed','completed')
   AND p.status IN ('pending','verified');
