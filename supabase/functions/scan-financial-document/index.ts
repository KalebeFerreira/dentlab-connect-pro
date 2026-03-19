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

## REGRA PRINCIPAL - LEIA COM ATENÇÃO:
- Se o documento mostra que VOCÊ PAGOU algo (comprou material, pagou conta, pagou fornecedor, fez PIX para alguém, pagou boleto) = É **DESPESA** (payment)
- Se o documento mostra que VOCÊ RECEBEU dinheiro (cliente pagou você, recebeu por serviço prestado) = É **RECEITA** (receipt)

## CLASSIFICAÇÃO DETALHADA:

### DESPESA (transaction_type: "payment") - Dinheiro SAINDO do caixa:
- **Comprovantes de PIX/transferência ENVIADA** (você mandou dinheiro para alguém)
- **Boletos pagos** (SEMPRE é despesa, sem exceção)
- **Notas fiscais de COMPRA** de materiais, produtos, insumos
- **Cupons fiscais de lojas/farmácias/fornecedores** (você comprou algo)
- **Recibos de pagamento EFETUADO** (você pagou alguém)
- **Contas de consumo** (água, luz, aluguel, internet, telefone)
- **Faturas de fornecedores**
- **Comprovantes de depósito/transferência onde VOCÊ é o pagador**
- Palavras-chave: "Pague a", "Pagamento de", "Compra de", "Débito", "Transferência enviada", "PIX enviado", "Boleto"

### RECEITA (transaction_type: "receipt") - Dinheiro ENTRANDO no caixa:
- Recibos de pagamento RECEBIDO de clientes/pacientes
- Comprovantes de PIX/transferência RECEBIDA (alguém mandou dinheiro para você)
- Notas fiscais onde você é o VENDEDOR/PRESTADOR de serviço
- Ordens de serviço pagas por dentistas/clínicas
- Palavras-chave: "Recebemos de", "Valor recebido", "Crédito", "Transferência recebida"

## ATENÇÃO ESPECIAL:
1. **Comprovante de PIX**: Verifique se VOCÊ ENVIOU ou RECEBEU. Se enviou = DESPESA. Se recebeu = RECEITA.
2. **Boletos**: São SEMPRE DESPESA (você está pagando algo)
3. **Cupom fiscal de loja**: SEMPRE DESPESA (você comprou algo)
4. **Nota fiscal**: Verifique se você é COMPRADOR (despesa) ou VENDEDOR (receita)
5. **Na dúvida entre receita e despesa, classifique como DESPESA** - é mais seguro para o controle financeiro

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

REGRA FINAL: Se o documento é um COMPROVANTE DE PAGAMENTO (você pagou algo), classifique OBRIGATORIAMENTE como "payment" (DESPESA). NÃO classifique pagamentos feitos por você como receita.`;

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
