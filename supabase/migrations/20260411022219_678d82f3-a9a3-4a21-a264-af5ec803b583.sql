
-- Tabela de configurações fiscais do usuário
CREATE TABLE public.fiscal_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  inscricao_municipal text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  endereco_cep text,
  endereco_codigo_municipio text,
  certificado_base64 text,
  certificado_senha_encrypted text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fiscal settings"
  ON public.fiscal_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fiscal settings"
  ON public.fiscal_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fiscal settings"
  ON public.fiscal_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fiscal settings"
  ON public.fiscal_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de notas fiscais emitidas
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  service_id uuid REFERENCES public.services(id),
  cliente_nome text NOT NULL,
  cliente_documento text NOT NULL,
  descricao_servico text NOT NULL,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'processando',
  numero_nota text,
  pdf_url text,
  xml_url text,
  nuvem_fiscal_id text,
  error_message text,
  data_emissao timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
