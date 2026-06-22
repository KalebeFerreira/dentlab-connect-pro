
# Plano: Relatórios À Vista vs Mensalistas + Aba de Agendamentos no Financeiro

## 1. Financeiro → nova aba "Relatórios por Cliente"

Em `src/pages/Financial.tsx`, adicionar aba `Relatórios` com 2 sub-abas:

- **À Vista** — clientes classificados como `a_vista` em `client_payment_profiles` + transações com `payment_method = 'a_vista'`
- **Mensalistas / Parcelado** — clientes `mensalista` + transações com `payment_method = 'a_prazo'`

Para cada sub-aba, lucro consolidado por período:
- Semanal (últimos 7 dias)
- Quinzenal (últimos 15 dias)
- Mensal (mês corrente)
- Anual (ano corrente)

Cada período mostra: total recebido, a receber, vencido, lucro líquido (receita − despesas do período).

**Tabela com nomes dos clientes/pacientes** em cada categoria:
- Nome, nº de transações, total recebido, pendente, vencido, última transação
- Ordenado por valor total (desc)

Novo componente: `src/components/billing/PaymentTypeReports.tsx` (gráficos recharts + tabela).

## 2. Financeiro → nova aba "Agendamentos"

Em vez de mexer em `src/pages/Appointments.tsx`, criar a aba dentro do próprio `Financial.tsx`:

- **Contas a vencer**: `appointments.treatment_value` com `status = 'completed'`, `paid_at IS NULL`, `due_date >= hoje`
- **Contas vencidas**: idem com `due_date < hoje`
- **Contas pagas (mês)**: `paid_at` dentro do mês corrente
- **Total previsto (mês)**

Cada card expande lista com **nome do paciente**, procedimento, valor, vencimento e botão **"Marcar como pago"** (atualiza `paid_at = hoje` em `appointments`).

Tudo já é sincronizado para `financial_transactions` pelo trigger existente `sync_appointment_to_transactions` — refletindo nos cards do topo do Financeiro automaticamente.

Novo componente: `src/components/billing/AppointmentsFinancialTab.tsx`.

## 3. Sem mudanças de schema

Nenhuma migração. Usa: `financial_transactions`, `client_payment_profiles`, `appointments`, `patients`, `services`.

## Arquivos

- **novo** `src/components/billing/PaymentTypeReports.tsx`
- **novo** `src/components/billing/AppointmentsFinancialTab.tsx`
- **editar** `src/pages/Financial.tsx` — adicionar 2 abas: "Relatórios" e "Agendamentos"

## Detalhes técnicos

- Períodos calculados com `date-fns` (`subDays`, `startOfMonth`, `startOfYear`).
- Classificação: registro em `client_payment_profiles` tem prioridade; fallback para `payment_method` da transação.
- Nome do paciente via JOIN com `patients` para transações de agendamento; `client_name` direto para `services`.
- Realtime de `Financial.tsx` já cobre atualizações; adicionar canal para `appointments` na nova aba.
