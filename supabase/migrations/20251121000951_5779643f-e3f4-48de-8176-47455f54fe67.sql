-- Enable realtime for orders table to support push notifications
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add orders table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;