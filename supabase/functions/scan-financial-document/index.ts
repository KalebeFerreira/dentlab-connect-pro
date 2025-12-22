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

    const systemPrompt = `Você é um especialista em OCR e extração de dados de documentos financeiros.
Analise a imagem de um documento financeiro (nota fiscal, recibo, boleto, comprovante, etc) e extraia os seguintes dados:

- transaction_type: Tipo da transação. Use "receipt" para receitas/entradas (vendas, pagamentos recebidos) ou "payment" para despesas/saídas (compras, pagamentos, contas)
- amount: Valor total do documento (apenas números, sem R$)
- description: Descrição do documento (nome do fornecedor/cliente, serviço prestado, produto comprado, etc)
- vendor_name: Nome do fornecedor ou empresa emissor do documento
- document_number: Número da nota fiscal, recibo ou documento (se houver)
- date: Data do documento no formato YYYY-MM-DD (se identificável)

IMPORTANTE: Além de extrair os dados estruturados, você DEVE incluir um campo "raw_text" contendo TODO o texto que você conseguiu ler da imagem, mesmo que parcialmente legível.

REGRAS PARA IDENTIFICAR O TIPO:
- Se o documento menciona "venda", "recebido de", "prestação de serviço para", "nota de serviço" → transaction_type = "receipt" (receita)
- Se o documento menciona "compra", "pagamento a", "fornecedor", "conta de luz/água/internet", "despesa" → transaction_type = "payment" (despesa)
- Na dúvida, analise o contexto do documento

Retorne APENAS um JSON válido no seguinte formato, sem explicações:
{
  "transaction_type": "receipt" ou "payment",
  "amount": number ou null,
  "description": "string ou null",
  "vendor_name": "string ou null",
  "document_number": "string ou null",
  "date": "YYYY-MM-DD ou null",
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
                text: 'Extraia os dados e todo o texto deste documento financeiro (nota fiscal, recibo, comprovante, etc):'
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
