import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log('Processando imagem para extração de dados via Lovable AI...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      throw new Error('Configuração de IA não encontrada');
    }

    const systemPrompt = `Você é um especialista em OCR e extração de dados de documentos odontológicos.
Analise a imagem de uma requisição de serviço odontológico e extraia os seguintes dados:

- clinic_name: Nome da clínica ou consultório (também pode aparecer como "cliente" ou "dentista")
- patient_name: Nome do paciente
- service_name: Tipo de trabalho/serviço a ser executado (ex: coroa, prótese, faceta, etc)
- service_value: Valor do serviço (apenas números, sem R$)
- work_type: Tipo específico do trabalho (ex: Coroa, Prótese Total, Faceta, Onlay, Inlay, Ponte, etc)
- color: Cor do trabalho dental (ex: A1, A2, A3, B1, B2, Bleach, etc - cores da escala Vita)

IMPORTANTE: Além de extrair os dados estruturados, você DEVE incluir um campo "raw_text" contendo TODO o texto que você conseguiu ler da imagem, mesmo que parcialmente legível.

Retorne APENAS um JSON válido no seguinte formato, sem explicações:
{
  "clinic_name": "string ou null",
  "patient_name": "string ou null", 
  "service_name": "string ou null",
  "service_value": "number ou null",
  "work_type": "string ou null",
  "color": "string ou null",
  "raw_text": "todo o texto identificado na imagem, separado por linhas"
}

Se não conseguir identificar algum campo, retorne null para esse campo.
Seja preciso na extração e tente identificar mesmo com escrita manual.`;

    // Usar Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados e todo o texto desta requisição de serviço odontológico:'
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
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Lovable AI Gateway:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos de IA esgotados. Adicione créditos na sua conta Lovable.');
      }
      
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta Lovable AI:', JSON.stringify(data));
    
    const content = data.choices?.[0]?.message?.content || '';
    const extractedData = parseAIResponse(content);
    const rawText = extractedData.raw_text || '';

    // Garantir que service_value seja número
    if (extractedData.service_value) {
      const cleanValue = String(extractedData.service_value).replace(/[^\d.,]/g, '').replace(',', '.');
      extractedData.service_value = parseFloat(cleanValue) || null;
    }

    console.log('Dados extraídos:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        raw_text: rawText
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no scan-document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        data: {
          clinic_name: null,
          patient_name: null,
          service_name: null,
          service_value: null,
          work_type: null,
          color: null,
          raw_text: 'Erro ao processar - preencha manualmente'
        }
      }),
      { 
        status: 200, // Retornar 200 para permitir preenchimento manual
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function parseAIResponse(content: string) {
  try {
    // Tentar encontrar JSON na resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      return JSON.parse(content);
    }
  } catch (parseError) {
    console.error('Erro ao parsear resposta:', content);
    return {
      clinic_name: null,
      patient_name: null,
      service_name: null,
      service_value: null,
      work_type: null,
      color: null,
      raw_text: content || 'Não foi possível extrair texto'
    };
  }
}
