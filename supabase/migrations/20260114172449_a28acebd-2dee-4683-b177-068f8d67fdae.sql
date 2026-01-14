-- Add favorite_laboratory_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS favorite_laboratory_id UUID REFERENCES public.laboratory_info(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_favorite_laboratory ON public.profiles(favorite_laboratory_id);