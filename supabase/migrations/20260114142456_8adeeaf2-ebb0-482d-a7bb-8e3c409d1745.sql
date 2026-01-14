-- Create marketing_campaigns table
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  campaign_type TEXT NOT NULL DEFAULT 'promotional',
  target_audience TEXT,
  budget NUMERIC(10, 2) DEFAULT 0,
  spent NUMERIC(10, 2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_media table for storing campaign images and files
CREATE TABLE public.campaign_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  sort_order INTEGER DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.marketing_campaigns 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.marketing_campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.marketing_campaigns 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
ON public.marketing_campaigns 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for campaign_media
CREATE POLICY "Users can view their own campaign media" 
ON public.campaign_media 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaign media" 
ON public.campaign_media 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign media" 
ON public.campaign_media 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaign media" 
ON public.campaign_media 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for campaign media
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-media', 'campaign-media', true);

-- Storage policies for campaign-media bucket
CREATE POLICY "Users can view campaign media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'campaign-media');

CREATE POLICY "Authenticated users can upload campaign media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'campaign-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own campaign media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own campaign media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updating timestamp
CREATE TRIGGER update_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();