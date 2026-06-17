## 1. Cards de pagamento responsivos no /billing

Arquivo: `src/components/billing/PaymentSummaryCards.tsx`

Hoje o grid é `grid-cols-1 md:grid-cols-3`, mas os cards ainda quebram em telas pequenas porque os valores em BRL ficam grandes e o título "A receber (próx. mês)" estoura largura no celular.

Ajustes:
- Trocar grid para `grid-cols-1 sm:grid-cols-3` e `gap-2 sm:gap-3` para melhor uso em telas estreitas (cards empilhados no mobile, lado a lado a partir de 640px).
- Aplicar `min-w-0` no Card e nos containers internos para evitar overflow horizontal.
- Reduzir tamanho do valor no mobile (`text-base sm:text-xl md:text-2xl`) e do título (`text-xs`), com `truncate`/`break-words` no valor.
- Encurtar título "A receber (próx. mês)" → "A receber" e mover "(próx. mês)" para a descrição secundária.
- Garantir `overflow-hidden` no Card e remover paddings horizontais excessivos no mobile (`px-3 sm:px-4 md:px-6`).

## 2. Opções de pagamento ao gerar/exportar relatório financeiro

Arquivo: `src/components/billing/MonthlyReports.tsx` e edge function `supabase/functions/generate-monthly-report-pdf/index.ts`.

Adicionar, na seção de geração de relatório mensal, um **Select de filtro de pagamento** com 4 opções:
- **Completo** (padrão — todos os serviços, com totais separados)
- **Somente à vista pagas**
- **Somente não pagas / a receber**
- **Somente vencidas**

Comportamento:
- Novo estado `paymentFilter` (`'all' | 'cash_paid' | 'unpaid' | 'overdue'`).
- Aplicar o filtro sobre `monthlyServices`, `clientMonthlyServices` e `consolidatedServices` antes de calcular totais e enviar para a edge function.
- Calcular três subtotais (`totalCash`, `totalReceivable`, `totalOverdue`) e o total geral, enviando todos no body da edge function como `paymentSummary`.
- Aplicar o mesmo filtro no `handleExportExcel`, adicionando linhas de subtotal por status quando `paymentFilter === 'all'`.

Edge function `generate-monthly-report-pdf/index.ts`:
- Aceitar `paymentSummary` no body.
- Quando presente, renderizar bloco "Resumo de Pagamentos" no PDF com:
  - Total Recebido à Vista
  - Total a Receber
  - Total Vencido
  - Total Geral
- A tabela já mostra a coluna Pagamento (status + due_date) implementada anteriormente — manter.

## Detalhes técnicos

- Não alterar schema do banco.
- Sem mudanças em `ServiceForm` / `EditServiceDialog`.
- O filtro é puramente client-side; a edge function só renderiza o que receber.
- Manter compatibilidade: se `paymentFilter === 'all'` e nenhum `paymentSummary` for enviado, o PDF segue como está hoje.

## Arquivos alterados

- `src/components/billing/PaymentSummaryCards.tsx` (responsividade)
- `src/components/billing/MonthlyReports.tsx` (Select de filtro + cálculos + Excel)
- `supabase/functions/generate-monthly-report-pdf/index.ts` (bloco de resumo)
