## Integração financeira automática + melhorias no Dashboard da Clínica

### O que vai acontecer automaticamente

| Evento | Lança no Financeiro | Categoria | Status |
|---|---|---|---|
| Agendamento concluído com valor de tratamento | Receita | "Tratamento" | Recebido (à vista) / Pendente (a prazo) |
| Agendamento concluído com `dentist_payment` | Despesa | "Pagamento Dentista" | Pendente |
| Ordem de laboratório marcada como entregue/concluída com `amount` | Despesa | "Laboratório" | Pendente |
| Alteração/cancelamento desses registros | Atualiza/remove a transação vinculada | — | — |

Tudo aparece no Financeiro e no Faturamento sem precisar lançar à mão.

### Mudanças no banco

1. **Tabela `appointments`** — adicionar:
   - `treatment_value` (numeric) — valor cobrado do paciente
   - `payment_method` (a_vista / a_prazo)
   - `paid_at`, `due_date`

2. **Triggers novos** (sincronizam com `financial_transactions` usando marcador no `description`, igual ao padrão já existente em `sync_work_record_to_transaction`):
   - `sync_appointment_to_transactions` — em INSERT/UPDATE/DELETE de `appointments`. Cria 1 receita (tratamento) e 1 despesa (pagamento ao dentista) quando o agendamento estiver `status = completed`. Marcadores: `[AGD-REC:<id>]` e `[AGD-DESP:<id>]`.
   - `sync_order_to_transaction` — em INSERT/UPDATE/DELETE de `orders`. Cria despesa apenas quando `status = completed` (entregue) e `amount > 0`. Marcador: `[ORD:<id>]`.
   - Vincular também os triggers já existentes mas sem binding: `sync_service_to_transaction` em `services` e `sync_work_record_to_transaction` em `work_records`.

### Mudanças na UI

1. **Formulário de Agendamento (`Appointments.tsx`)** — novos campos opcionais: Valor do Tratamento, Pagamento ao Dentista, Forma de Pagamento, Vencimento. Aviso visual: "Será lançado automaticamente no financeiro quando o agendamento for concluído".

2. **Formulário de Ordem (`NewOrder.tsx` / `EditOrderDialog`)** — mantém `amount`; adicionar nota "Será lançado como despesa quando a ordem for marcada como entregue".

3. **Dashboard da Clínica** — novo bloco `ClinicFinancialSummary` acima de `OrdersSummary`:
   - 4 cards: Receita do mês, Despesa do mês, Resultado (lucro), A receber
   - Mini gráfico de barras (receita vs despesa últimos 6 meses)
   - Botão "Ver Financeiro" → `/financial`
   - Respeita o `HideValuesToggle` global

### Detalhes técnicos

- Triggers em PL/pgSQL com `SECURITY DEFINER` e `SET search_path = public` (padrão do projeto).
- Idempotência: ao atualizar agendamento/ordem, o trigger faz UPSERT no `financial_transactions` filtrando pelo marcador no `description` (mesmo padrão de `[TRAB:<id>]`).
- Quando o status volta de `completed` para outro, a transação correspondente é removida.
- `treatment_value` ou `dentist_payment` zerados/null → não cria/remove a transação correspondente.
- Categorias gravadas em `financial_transactions.category` para os gráficos do `FinancialCharts` agruparem corretamente.

### Arquivos afetados

- Migração SQL (novas colunas + 3 triggers + binding dos 2 triggers órfãos)
- `src/pages/Appointments.tsx` (campos no form)
- `src/components/EditOrderDialog.tsx` e `src/pages/NewOrder.tsx` (nota informativa)
- `src/components/clinic/ClinicFinancialSummary.tsx` (novo)
- `src/pages/ClinicDashboard.tsx` (incluir o novo componente)
