-- Create table to track weekly free day usage per vehicle
CREATE TABLE public.vehicle_free_day_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, week_start)
);

-- Enable RLS
ALTER TABLE public.vehicle_free_day_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own free day usage"
ON public.vehicle_free_day_usage
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free day usage"
ON public.vehicle_free_day_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_vehicle_free_day_week ON public.vehicle_free_day_usage(vehicle_id, week_start);