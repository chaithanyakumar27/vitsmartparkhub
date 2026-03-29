
CREATE TABLE public.car_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  make text,
  model text,
  length_cm numeric NOT NULL,
  width_cm numeric NOT NULL,
  height_cm numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.car_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view car dimensions"
  ON public.car_dimensions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Staff can manage car dimensions"
  ON public.car_dimensions FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

ALTER TABLE public.parking_slots
  ADD COLUMN IF NOT EXISTS slot_length_cm numeric DEFAULT 500,
  ADD COLUMN IF NOT EXISTS slot_width_cm numeric DEFAULT 250;

INSERT INTO public.car_dimensions (category, make, model, length_cm, width_cm, height_cm) VALUES
  ('sedan', 'Maruti', 'Dzire', 399, 173, 151),
  ('sedan', 'Honda', 'City', 455, 175, 148),
  ('sedan', 'Hyundai', 'Verna', 460, 177, 147),
  ('sedan', 'Toyota', 'Camry', 488, 184, 145),
  ('hatchback', 'Maruti', 'Swift', 384, 173, 152),
  ('hatchback', 'Maruti', 'Alto', 345, 149, 152),
  ('hatchback', 'Hyundai', 'i20', 415, 177, 150),
  ('hatchback', 'Tata', 'Altroz', 437, 177, 152),
  ('SUV', 'Hyundai', 'Creta', 454, 179, 163),
  ('SUV', 'Tata', 'Nexon', 421, 181, 160),
  ('SUV', 'Kia', 'Seltos', 464, 180, 164),
  ('SUV', 'Toyota', 'Fortuner', 484, 186, 184),
  ('SUV', 'Mahindra', 'XUV700', 470, 189, 175),
  ('motorcycle', 'Honda', 'Activa', 184, 71, 116),
  ('motorcycle', 'Royal Enfield', 'Classic 350', 219, 79, 117),
  ('motorcycle', 'Bajaj', 'Pulsar', 204, 75, 107),
  ('scooter', 'TVS', 'Jupiter', 184, 66, 115),
  ('scooter', 'Honda', 'Dio', 187, 67, 110),
  ('bicycle', 'Generic', 'Standard', 180, 60, 100);
