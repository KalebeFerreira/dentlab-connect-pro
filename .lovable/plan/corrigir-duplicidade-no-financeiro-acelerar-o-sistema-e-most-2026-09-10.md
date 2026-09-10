# Corrigir duplicidade no financeiro, acelerar o sistema e mostrar produção bruta e líquida

## O que está acontecendo hoje (verificado no banco)

1. **Lançamento duplicado**: cada serviço lançado no faturamento cria **dois** registros idênticos no financeiro. Motivo confirmado: existem dois gatilhos automáticos apontando para a mesma rotina na tabela de serviços (`trg_sync_service_to_transaction` e `trigger_sync_service_to_transaction`). O mesmo acontece nos registros de produção dos funcionários (`trg_sync_work_record_to_transaction` e `trigger_sync_work_record`). Hoje há **640 serviços** com lançamento duplicado (mesmo valor, mesmo horário de criação).
2. **Lentidão**: as consultas mais pesadas do sistema são justamente as do financeiro. A tabela de transações não tem índice por usuário/mês/ano nem por vencimento; uma das telas carrega o **ano inteiro** de transações de uma vez (média de 111 ms por chamada, com picos). Ordens, produção e agenda também não têm índice por usuário.
3. **Despesas aparecendo zeradas**: a tela financeira soma despesas procurando o tipo "payment", mas os lançamentos automáticos são gravados como "expense". Isso faz o Lucro ficar inflado. Será corrigido junto.

## O que será feito

### 1. Acabar com a duplicidade
- Remover o gatilho repetido em Serviços e em Registros de Produção (fica apenas um de cada).
- Impedir que volte a acontecer: criar uma regra de unicidade no financeiro por origem (um lançamento por serviço/ordem/agendamento).
- Limpeza dos duplicados já existentes: apagar as cópias extras mantendo sempre o registro mais antigo de cada origem. Nada de valor original é perdido — apenas as cópias.

### 2. Deixar o sistema mais rápido
- Criar índices em: transações (usuário + ano + mês; usuário + vencimento; usuário + data de criação), ordens (usuário), produção (usuário e funcionário), agenda (usuário + data), pacientes (usuário).
- Ajustar as telas financeiras para sempre filtrar pelo usuário e pelo período escolhido, em vez de puxar o ano inteiro, e carregar os dados anuais só quando a aba de gráficos/comparativos for aberta.
- Buscar apenas as colunas usadas nas listagens em vez de `*`.

### 3. Resumos corretos e sem repetição no painel financeiro
- Corrigir a soma de Despesas para reconhecer os lançamentos automáticos.
- Garantir que cada lançamento entre uma única vez em Receitas, A receber, Vencidos, Despesas e Lucro (nenhum valor contado duas vezes entre os cartões).

### 4. Valor bruto e líquido de produção
Dois novos cartões no painel financeiro, no período selecionado:
- **Produção bruta**: soma de tudo que foi produzido/faturado no mês (serviços, ordens e tratamentos), pago ou a receber.
- **Produção líquida**: produção bruta menos os custos ligados à produção (pagamento de funcionários, dentistas e demais despesas do período).
Os mesmos dois totais entram também no relatório em PDF do financeiro.

## Detalhes técnicos

- Migração: `DROP TRIGGER trigger_sync_service_to_transaction ON public.services` e `DROP TRIGGER trigger_sync_work_record ON public.work_records`.
- Deduplicação via `DELETE ... USING` mantendo `min(ctid)`/menor `id` por `service_id` e por marcador `[TRAB:<id>]` na descrição.
- Índice único parcial em `financial_transactions(service_id) WHERE service_id IS NOT NULL` e em `(order_id) WHERE order_id IS NOT NULL`; para agendamentos e trabalhos, unicidade pelo marcador na descrição.
- Novos índices: `financial_transactions(user_id, year, month)`, `(user_id, due_date) WHERE paid_at IS NULL`, `(user_id, created_at DESC)`, `orders(user_id)`, `work_records(user_id, employee_id)`, `appointments(user_id, appointment_date)`, `patients(user_id)`.
- `src/pages/Financial.tsx`: `.eq("user_id", user.id)` em ambas as cargas, seleção de colunas explícita, carga anual sob demanda, `expense` no lugar de `payment` em `calculateTotals`, e novos totais `producaoBruta` / `producaoLiquida`.
- `src/components/FinancialExportOptions.tsx` e `supabase/functions/generate-financial-pdf`: incluir os dois novos totais.
