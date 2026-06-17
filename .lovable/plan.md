## Onde os novos cartões foram adicionados

Os 3 novos cartões (**Recebido à vista**, **A receber (próx. mês)**, **Vencido**) e o painel **Bons Pagadores / Inadimplentes** foram colocados na página **Controle Financeiro** (`/financial`), logo abaixo dos 4 cartões antigos (Receitas, Despesas, Lucro, Pendentes) e acima da seção de Insights/Gráficos.

## Por que provavelmente você não está vendo

1. **Filtro de mês/ano** — a página filtra por mês corrente (junho/2026). Se não há transações nesse mês, todos os valores aparecem como R$ 0,00 (mas os cartões devem aparecer mesmo assim, zerados).
2. **Você pode estar olhando em outra página** — esses cartões NÃO foram adicionados em `/billing` (Faturamento), só em `/financial`.
3. **Cache do navegador / PWA** — service worker pode estar servindo versão antiga.

## Proposta de correção

Para que o recurso fique mais visível e útil, sugiro:

1. **Replicar os 3 cartões (à vista / a receber / vencido) também na página `/billing`** (Faturamento), pois é lá que o usuário cadastra serviços com forma de pagamento — faz sentido ver o resumo no mesmo lugar.
2. **Adicionar o painel "Bons Pagadores / Inadimplentes" também em `/billing`** dentro de uma nova aba "Clientes" ou na aba Relatórios.
3. **Calcular os totais a partir da tabela `services`** (não só de `financial_transactions`), porque a forma de pagamento é cadastrada no ServiceForm — hoje os cartões em `/financial` só leem `financial_transactions`, então serviços lançados em Faturamento não aparecem ali a menos que gerem transação financeira.
4. **Forçar refresh do service worker** (atualizar versão do PWA) para garantir que o build novo seja carregado.

## Pergunta antes de implementar

Você quer que eu:
- (A) Apenas garanta que os cartões já existentes em `/financial` apareçam corretamente (forçar reload do PWA), **ou**
- (B) Também duplique esses cartões + painel de clientes na página `/billing` (Faturamento), somando dados de `services` + `financial_transactions`?

Me confirme A ou B para eu seguir.