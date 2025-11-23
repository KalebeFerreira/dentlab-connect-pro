-- Create certificate_templates table
CREATE TABLE public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_reason TEXT NOT NULL,
  default_days INTEGER NOT NULL DEFAULT 1,
  default_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own certificate templates"
ON public.certificate_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own certificate templates"
ON public.certificate_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certificate templates"
ON public.certificate_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own certificate templates"
ON public.certificate_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_certificate_templates_updated_at
BEFORE UPDATE ON public.certificate_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.certificate_templates (user_id, template_name, category, default_reason, default_days, default_text)
SELECT 
  auth.uid(),
  'Extração Dentária',
  'Cirurgia',
  'Extração de elemento dentário',
  1,
  'Atesto para os devidos fins que o(a) paciente {patientName} esteve sob meus cuidados profissionais, sendo submetido(a) a procedimento de extração dentária, necessitando de repouso de {days} dia(s).'
WHERE auth.uid() IS NOT NULL;

INSERT INTO public.certificate_templates (user_id, template_name, category, default_reason, default_days, default_text)
SELECT 
  auth.uid(),
  'Tratamento de Canal',
  'Endodontia',
  'Tratamento endodôntico',
  1,
  'Atesto para os devidos fins que o(a) paciente {patientName} esteve sob meus cuidados profissionais para tratamento endodôntico (canal), necessitando de afastamento de {days} dia(s) de suas atividades.'
WHERE auth.uid() IS NOT NULL;

INSERT INTO public.certificate_templates (user_id, template_name, category, default_reason, default_days, default_text)
SELECT 
  auth.uid(),
  'Implante Dentário',
  'Implantodontia',
  'Colocação de implante dentário',
  2,
  'Atesto que o(a) paciente {patientName} foi submetido(a) a procedimento cirúrgico de implante dentário, necessitando de repouso de {days} dias para adequada recuperação pós-operatória.'
WHERE auth.uid() IS NOT NULL;

INSERT INTO public.certificate_templates (user_id, template_name, category, default_reason, default_days, default_text)
SELECT 
  auth.uid(),
  'Urgência Odontológica',
  'Emergência',
  'Urgência odontológica',
  1,
  'Atesto para os devidos fins que o(a) paciente {patientName} necessitou de atendimento odontológico de urgência, sendo necessário o afastamento de {days} dia(s) de suas atividades habituais.'
WHERE auth.uid() IS NOT NULL;