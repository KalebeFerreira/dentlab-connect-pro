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

    console.log('Processando documento financeiro via Lovable AI...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      throw new Error('Configuração de IA não encontrada');
    }

const systemPrompt = `Extraia dados de documento financeiro. Retorne JSON:
{"transaction_type":"receipt|payment","amount":number|null,"description":"string|null","vendor_name":"string|null","document_number":"string|null","date":"YYYY-MM-DD|null"}
receipt=receita/venda, payment=despesa/compra. Seja rápido e direto.`;

    // Usar Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
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
                text: 'Extraia dados deste documento:'
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
        max_tokens: 500,
        temperature: 0
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

    // Garantir que amount seja número
    if (extractedData.amount) {
      const cleanValue = String(extractedData.amount).replace(/[^\d.,]/g, '').replace(',', '.');
      extractedData.amount = parseFloat(cleanValue) || null;
    }

    console.log('Dados financeiros extraídos:', extractedData);

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
    console.error('Erro no scan-financial-document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        data: {
          transaction_type: null,
          amount: null,
          description: null,
          vendor_name: null,
          document_number: null,
          date: null,
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
      transaction_type: null,
      amount: null,
      description: null,
      vendor_name: null,
      document_number: null,
      date: null,
      raw_text: content || 'Não foi possível extrair texto'
    };
  }
}
