
-- Add quantity and unit_price columns to orders table
ALTER TABLE public.orders 
ADD COLUMN quantity integer NOT NULL DEFAULT 1,
ADD COLUMN unit_price numeric NULL;

-- Update existing orders: set unit_price = amount where amount exists
UPDATE public.orders SET unit_price = amount WHERE amount IS NOT NULL;
