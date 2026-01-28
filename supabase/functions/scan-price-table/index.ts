import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    console.log('Processando imagem de tabela de preços...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      throw new Error('Configuração de IA não encontrada');
    }

    const systemPrompt = `Você é um especialista em OCR e extração de dados de tabelas de preços odontológicos.
Analise a imagem e extraia TODOS os itens da tabela de preços.

Para cada item, extraia:
- workType: Tipo do trabalho/serviço (ex: Coroa, Prótese, Faceta, Implante, etc)
- description: Descrição adicional do serviço (material, técnica, etc)
- price: Valor numérico do serviço (apenas números, sem R$ ou vírgulas)

Retorne APENAS um JSON válido no seguinte formato, sem explicações:
{
  "items": [
    { "workType": "string", "description": "string", "price": "string" },
    { "workType": "string", "description": "string", "price": "string" }
  ]
}

IMPORTANTE:
- Extraia TODOS os itens visíveis na tabela
- Se não encontrar preço, use "0"
- Se não encontrar descrição, deixe string vazia
- Ordene os itens na mesma ordem que aparecem na imagem
- Se a imagem não contiver uma tabela de preços clara, retorne items vazio: { "items": [] }`;

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
                text: 'Extraia todos os itens desta tabela de preços odontológicos:'
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
        max_tokens: 4000,
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
        throw new Error('Créditos de IA esgotados.');
      }
      
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta Lovable AI:', JSON.stringify(data).substring(0, 500));
    
    const content = data.choices?.[0]?.message?.content || '';
    const extractedData = parseAIResponse(content);

    console.log(`Itens extraídos: ${extractedData.items?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        items: extractedData.items || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no scan-price-table:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        items: []
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function parseAIResponse(content: string) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate and clean items
      if (parsed.items && Array.isArray(parsed.items)) {
        parsed.items = parsed.items.map((item: any) => ({
          workType: String(item.workType || '').trim(),
          description: String(item.description || '').trim(),
          price: String(item.price || '0').replace(/[^\d.,]/g, '').replace(',', '.') || '0'
        })).filter((item: any) => item.workType);
      }
      return parsed;
    }
    return { items: [] };
  } catch (parseError) {
    console.error('Erro ao parsear resposta:', content.substring(0, 200));
    return { items: [] };
  }
}
