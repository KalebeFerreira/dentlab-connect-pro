## Problema
Mesmo com o filtro aplicado, o PDF ainda mostra cards de resumo (Recebido à vista / A receber / Vencido). O usuário quer que, ao escolher um filtro específico, o relatório mostre **apenas a lista detalhada dos serviços daquela categoria + total**, sem nenhum card de resumo das outras categorias.

## Mudança (única)

### `supabase/functions/generate-monthly-report-pdf/index.ts`
Quando `paymentFilter !== 'all'`:
- **Remover totalmente** o bloco de cards de resumo (Recebido à vista / A receber / Vencido / Total geral).
- Manter no header apenas: período, "Filtro aplicado: <label>" e "Total de Serviços: N" (contagem já reflete o filtro porque a lista chega pré-filtrada).
- Manter as tabelas por clínica (já vêm filtradas).
- Manter o total final no rodapé, com label dinâmico ("Total Recebido à Vista" / "Total Não Pagas" / "Total Vencido").

Quando `paymentFilter === 'all'`:
- Comportamento atual (4 cards + total geral).

Nenhuma outra alteração em outros arquivos.
