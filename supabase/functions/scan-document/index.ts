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

    console.log('Processando imagem para extração de dados...');

    // Usar Google Gemini através do Supabase AI
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    const systemPrompt = `Você é um especialista em OCR e extração de dados de documentos odontológicos.
Analise a imagem de uma requisição de serviço odontológico e extraia os seguintes dados:

- clinic_name: Nome da clínica ou consultório
- patient_name: Nome do paciente
- service_name: Tipo de trabalho/serviço a ser executado (ex: coroa, prótese, etc)
- service_value: Valor do serviço (apenas números, sem R$)

IMPORTANTE: Além de extrair os dados estruturados, você DEVE incluir um campo "raw_text" contendo TODO o texto que você conseguiu ler da imagem, mesmo que parcialmente legível.

Retorne APENAS um JSON válido no seguinte formato, sem explicações:
{
  "clinic_name": "string ou null",
  "patient_name": "string ou null", 
  "service_name": "string ou null",
  "service_value": "number ou null",
  "raw_text": "todo o texto identificado na imagem, separado por linhas"
}

Se não conseguir identificar algum campo, retorne null para esse campo.
Seja preciso na extração e tente identificar mesmo com escrita manual.`;

    // Usar endpoint do Supabase AI Gateway
    const response = await fetch(`${supabaseUrl}/functions/v1/ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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

    let extractedData;
    let rawText = '';

    if (!response.ok) {
      console.log('Supabase AI não disponível, tentando OpenRouter...');
      
      // Fallback para OpenRouter com a API key direta
      const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
      
      if (openRouterKey) {
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://lovable.dev',
            'X-Title': 'Lovable Document Scanner'
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

        if (!openRouterResponse.ok) {
          const errorText = await openRouterResponse.text();
          console.error('Erro OpenRouter:', errorText);
          throw new Error(`Erro na API de IA: ${openRouterResponse.status}`);
        }

        const data = await openRouterResponse.json();
        console.log('Resposta OpenRouter:', JSON.stringify(data));
        
        const content = data.choices?.[0]?.message?.content || '';
        extractedData = parseAIResponse(content);
        rawText = extractedData.raw_text || '';
      } else {
        // Sem API key de fallback, retornar dados vazios para preenchimento manual
        console.log('Nenhuma API de IA disponível, retornando para preenchimento manual');
        extractedData = {
          clinic_name: null,
          patient_name: null,
          service_name: null,
          service_value: null,
          raw_text: 'IA não disponível - preencha os dados manualmente'
        };
        rawText = 'IA não disponível - preencha os dados manualmente';
      }
    } else {
      const data = await response.json();
      console.log('Resposta Supabase AI:', JSON.stringify(data));
      
      const content = data.choices?.[0]?.message?.content || '';
      extractedData = parseAIResponse(content);
      rawText = extractedData.raw_text || '';
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
      raw_text: content || 'Não foi possível extrair texto'
    };
  }
}
