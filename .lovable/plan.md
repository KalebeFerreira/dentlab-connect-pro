## Objetivo
No relatório mensal de faturamento, quando o usuário escolher um filtro específico (ex.: "Somente pagas à vista", "Somente não pagas", "Somente vencidas"), o PDF gerado deve mostrar apenas os dados referentes àquele filtro — sem os cards/totais das outras categorias.

Hoje, mesmo escolhendo um filtro, o PDF mostra os 4 cards (Recebido à vista, A receber, Vencido, Total geral) e o "Total Geral do Período". O usuário quer um relatório enxuto e focado.

## Mudanças

### `supabase/functions/generate-monthly-report-pdf/index.ts`
1. Ler o `paymentFilter` recebido (já existe).
2. Renderizar a seção de resumo (os 4 cards) **apenas quando `paymentFilter === 'all'`** (relatório completo).
3. Quando o filtro for específico, exibir somente **um card** correspondente:
   - `cash_paid` → card "Recebido à vista"
   - `unpaid` → cards "A receber" + "Vencido" (são os dois tipos de "não pagas")
   - `overdue` → card "Vencido"
4. Ajustar o "Total Geral do Período" no rodapé para refletir somente o subtotal do filtro escolhido, com label dinâmico (ex.: "Total recebido à vista", "Total a receber", "Total vencido", "Total não pagas").
5. Manter a tabela detalhada por clínica (que já vem pré-filtrada do client) — sem alteração na listagem em si.
6. Manter cabeçalho, dados da empresa, período e "Filtro aplicado".

### Sem mudanças
- `MonthlyReports.tsx` já envia `paymentFilter` e a lista de serviços já filtrada — nada a ajustar lá.
- Excel/CSV: o usuário pediu especificamente do relatório (PDF). Não mexer no export Excel.

## Resultado esperado
- Filtro "Completo" → PDF como hoje (4 cards + total geral).
- Filtro "Somente pagas à vista" → PDF mostra apenas o card de "Recebido à vista", tabelas com esses serviços e total = valor à vista.
- Filtro "Somente não pagas" → cards "A receber" e "Vencido", tabelas e total = soma dos não pagos.
- Filtro "Somente vencidas" → card "Vencido", tabelas e total = vencido.
