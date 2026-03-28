CREATE OR REPLACE FUNCTION public.validate_booking_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_zone_id uuid;
  slot_available boolean;
  vehicle_owner uuid;
BEGIN
  SELECT zone_id, COALESCE(is_available, true)
  INTO slot_zone_id, slot_available
  FROM public.parking_slots
  WHERE id = NEW.slot_id;

  IF slot_zone_id IS NULL THEN
    RAISE EXCEPTION 'Selected slot does not exist';
  END IF;

  IF slot_zone_id <> NEW.zone_id THEN
    RAISE EXCEPTION 'Selected slot does not belong to this zone';
  END IF;

  SELECT user_id
  INTO vehicle_owner
  FROM public.vehicles
  WHERE id = NEW.vehicle_id;

  IF vehicle_owner IS NULL OR vehicle_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Vehicle verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.slot_id = NEW.slot_id
      AND b.id <> COALESCE(NEW.id, gen_random_uuid())
      AND b.status IN ('pending', 'confirmed', 'active')
      AND tstzrange(b.start_time, COALESCE(b.end_time, b.start_time + interval '24 hour'), '[)') &&
          tstzrange(NEW.start_time, COALESCE(NEW.end_time, NEW.start_time + interval '24 hour'), '[)')
  ) THEN
    RAISE EXCEPTION 'Selected slot is already booked for this time';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_parking_slot_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.parking_slots
    SET is_available = false,
        is_reserved = true
    WHERE id = NEW.slot_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.slot_id <> OLD.slot_id THEN
      UPDATE public.parking_slots
      SET is_available = true,
          is_reserved = false
      WHERE id = OLD.slot_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.slot_id = OLD.slot_id
            AND b.status IN ('pending', 'confirmed', 'active')
        );

      UPDATE public.parking_slots
      SET is_available = false,
          is_reserved = true
      WHERE id = NEW.slot_id;
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed', 'cancelled') THEN
      UPDATE public.parking_slots
      SET is_available = true,
          is_reserved = false
      WHERE id = NEW.slot_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.slot_id = NEW.slot_id
            AND b.id <> NEW.id
            AND b.status IN ('pending', 'confirmed', 'active')
        );
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('pending', 'confirmed', 'active') THEN
      UPDATE public.parking_slots
      SET is_available = false,
          is_reserved = true
      WHERE id = NEW.slot_id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.parking_slots
    SET is_available = true,
        is_reserved = false
    WHERE id = OLD.slot_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.slot_id = OLD.slot_id
          AND b.id <> OLD.id
          AND b.status IN ('pending', 'confirmed', 'active')
      );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_slot_trigger ON public.bookings;
CREATE TRIGGER validate_booking_slot_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_slot();

DROP TRIGGER IF EXISTS sync_parking_slot_status_trigger ON public.bookings;
CREATE TRIGGER sync_parking_slot_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_parking_slot_status();

CREATE OR REPLACE FUNCTION public.complete_payment(_payment_id uuid, _payment_method text DEFAULT 'manual')
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_payment public.payments;
BEGIN
  UPDATE public.payments
  SET status = 'completed',
      payment_method = COALESCE(NULLIF(_payment_method, ''), 'manual'),
      paid_at = now()
  WHERE id = _payment_id
    AND user_id = auth.uid()
    AND status = 'pending'
  RETURNING * INTO updated_payment;

  IF updated_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found or already completed';
  END IF;

  RETURN updated_payment;
END;
$$;