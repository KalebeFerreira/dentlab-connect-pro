-- Create delivery_persons table for motoboys
CREATE TABLE public.delivery_persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'moto',
  license_plate TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating NUMERIC(3,2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deliveries table
CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  delivery_person_id UUID,
  order_id UUID,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC(10,8),
  pickup_lng NUMERIC(11,8),
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10,8),
  delivery_lng NUMERIC(11,8),
  distance_km NUMERIC(10,2),
  delivery_fee NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_time TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  notes TEXT,
  tracking_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (delivery_person_id) REFERENCES public.delivery_persons(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL
);

-- Create delivery_tracking table for real-time updates
CREATE TABLE public.delivery_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL,
  status TEXT NOT NULL,
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.delivery_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_persons
CREATE POLICY "Users can view their own delivery persons"
  ON public.delivery_persons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own delivery persons"
  ON public.delivery_persons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own delivery persons"
  ON public.delivery_persons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own delivery persons"
  ON public.delivery_persons FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for deliveries
CREATE POLICY "Users can view their own deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deliveries"
  ON public.deliveries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deliveries"
  ON public.deliveries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for delivery_tracking
CREATE POLICY "Users can view tracking for their deliveries"
  ON public.delivery_tracking FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deliveries
    WHERE deliveries.id = delivery_tracking.delivery_id
    AND deliveries.user_id = auth.uid()
  ));

CREATE POLICY "Users can create tracking for their deliveries"
  ON public.delivery_tracking FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deliveries
    WHERE deliveries.id = delivery_tracking.delivery_id
    AND deliveries.user_id = auth.uid()
  ));

-- Create function to generate tracking code
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate tracking code
CREATE OR REPLACE FUNCTION set_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := generate_tracking_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliveries_tracking_code
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION set_tracking_code();

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_persons_updated_at
  BEFORE UPDATE ON public.delivery_persons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for deliveries and tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;