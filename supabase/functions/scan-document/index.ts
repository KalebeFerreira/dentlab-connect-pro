import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error('Imagem não fornecida');
    }

    console.log('Processando imagem para extração de dados...');

    // Usar Lovable AI para extrair dados estruturados da imagem
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Lovable Document Scanner'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em OCR e extração de dados de documentos odontológicos.
Analise a imagem de uma requisição de serviço odontológico e extraia os seguintes dados:

- clinic_name: Nome da clínica ou consultório
- patient_name: Nome do paciente
- service_name: Tipo de trabalho/serviço a ser executado (ex: coroa, prótese, etc)
- service_value: Valor do serviço (apenas números, sem R$)

Retorne APENAS um JSON válido no seguinte formato, sem explicações:
{
  "clinic_name": "string ou null",
  "patient_name": "string ou null", 
  "service_name": "string ou null",
  "service_value": "number ou null"
}

Se não conseguir identificar algum campo, retorne null para esse campo.
Seja preciso na extração e tente identificar mesmo com escrita manual.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados desta requisição de serviço odontológico:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta da IA:', JSON.stringify(data));

    const content = data.choices?.[0]?.message?.content || '';
    
    // Extrair JSON da resposta
    let extractedData;
    try {
      // Tentar encontrar JSON na resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Erro ao parsear resposta:', content);
      extractedData = {
        clinic_name: null,
        patient_name: null,
        service_name: null,
        service_value: null
      };
    }

    // Garantir que service_value seja número
    if (extractedData.service_value) {
      const cleanValue = String(extractedData.service_value).replace(/[^\d.,]/g, '').replace(',', '.');
      extractedData.service_value = parseFloat(cleanValue) || null;
    }

    console.log('Dados extraídos:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no scan-document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
