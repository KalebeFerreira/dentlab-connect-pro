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

    const systemPrompt = `Você é um especialista em classificação de documentos financeiros para laboratórios de prótese dentária e clínicas odontológicas.

TAREFA: Analisar a imagem do documento e classificar CORRETAMENTE como RECEITA ou DESPESA.

## CRITÉRIOS DE CLASSIFICAÇÃO:

### RECEITA (transaction_type: "receipt") - Dinheiro ENTRANDO:
- Cupons fiscais/notas de VENDA de produtos ou serviços
- Recibos de pagamento RECEBIDO de clientes/pacientes
- Comprovantes de PIX/transferência RECEBIDA
- Notas fiscais onde o laboratório/clínica é o VENDEDOR/PRESTADOR
- Ordens de serviço pagas por dentistas/clínicas
- Documentos com "Recebemos de...", "Valor recebido", "Pagamento confirmado"
- Faturas de serviços prestados (próteses, trabalhos odontológicos)

### DESPESA (transaction_type: "payment") - Dinheiro SAINDO:
- Notas fiscais de COMPRA de materiais/produtos
- Boletos de pagamento (água, luz, aluguel, fornecedores)
- Comprovantes de PIX/transferência ENVIADA
- Notas onde o laboratório/clínica é o COMPRADOR/CLIENTE
- Faturas de fornecedores de materiais odontológicos
- Contas de consumo (energia, internet, telefone)
- Recibos de pagamento EFETUADO a terceiros
- Documentos com "Pague a...", "Pagamento de...", "Compra de..."

## DICAS PARA IDENTIFICAÇÃO:
1. Verifique QUEM está pagando e QUEM está recebendo
2. Procure por termos como "venda", "compra", "pagamento", "recebimento"
3. Identifique se é uma ENTRADA ou SAÍDA de dinheiro para o negócio
4. Boletos são SEMPRE despesas
5. Cupons fiscais de lojas/fornecedores são SEMPRE despesas

## FORMATO DE RESPOSTA (JSON estrito):
{
  "transaction_type": "receipt" | "payment",
  "amount": number | null,
  "description": "descrição clara do que é o documento",
  "vendor_name": "nome da empresa/pessoa envolvida",
  "document_number": "número do documento/nota/recibo",
  "date": "YYYY-MM-DD" | null,
  "category": "materials" | "fixed_costs" | "suppliers" | "services" | "salaries" | "taxes" | "other" | null,
  "confidence": "high" | "medium" | "low",
  "classification_reason": "breve explicação do porquê classificou assim"
}

## CATEGORIAS DE DESPESA (apenas se transaction_type = "payment"):
- "materials": Materiais de consumo, insumos, produtos odontológicos
- "fixed_costs": Contas fixas (água, luz, aluguel, internet, telefone)
- "suppliers": Fornecedores de equipamentos e materiais
- "services": Serviços contratados (manutenção, limpeza, etc)
- "salaries": Salários, pró-labore, funcionários
- "taxes": Impostos, taxas, contribuições
- "other": Outros gastos não classificados

IMPORTANTE: Seja PRECISO na classificação. Se for uma nota de compra de material, é DESPESA. Se for um recibo de serviço prestado, é RECEITA.`;

    // Usar Lovable AI Gateway com modelo mais capaz
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
                text: 'Analise este documento financeiro e classifique corretamente como RECEITA ou DESPESA:'
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
        max_tokens: 800,
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
    
    // Validar e normalizar transaction_type
    if (extractedData.transaction_type) {
      const type = String(extractedData.transaction_type).toLowerCase().trim();
      if (type === 'receipt' || type === 'receita' || type === 'entrada' || type === 'venda') {
        extractedData.transaction_type = 'receipt';
      } else if (type === 'payment' || type === 'despesa' || type === 'saída' || type === 'saida' || type === 'compra') {
        extractedData.transaction_type = 'payment';
      }
    }

    // Garantir que amount seja número
    if (extractedData.amount) {
      const cleanValue = String(extractedData.amount).replace(/[^\d.,]/g, '').replace(',', '.');
      extractedData.amount = parseFloat(cleanValue) || null;
    }

    // Log da classificação para debug
    console.log('Classificação:', {
      tipo: extractedData.transaction_type,
      confianca: extractedData.confidence,
      razao: extractedData.classification_reason
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          transaction_type: extractedData.transaction_type,
          amount: extractedData.amount,
          description: extractedData.description,
          vendor_name: extractedData.vendor_name,
          document_number: extractedData.document_number,
          date: extractedData.date
        },
        confidence: extractedData.confidence || 'medium',
        classification_reason: extractedData.classification_reason || null,
        raw_text: content
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
        status: 200,
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
