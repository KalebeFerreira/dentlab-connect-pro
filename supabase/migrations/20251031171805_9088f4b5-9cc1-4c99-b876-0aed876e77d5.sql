-- Create storage bucket for order files
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create table to track uploaded files
CREATE TABLE IF NOT EXISTS public.order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_files
CREATE POLICY "Users can view files from their own orders"
ON public.order_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_files.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload files to their own orders"
ON public.order_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_files.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete files from their own orders"
ON public.order_files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_files.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all files"
ON public.order_files FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all files"
ON public.order_files FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for order-files bucket
CREATE POLICY "Users can upload files to their orders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'order-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'order-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all order files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-files' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON public.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_uploaded_by ON public.order_files(uploaded_by);