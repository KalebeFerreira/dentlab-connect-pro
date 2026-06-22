## 1. Adicionar conta a vencer (botão + dialog)

Em `src/components/billing/AppointmentsFinancialTab.tsx`, adicionar botão **"+ Nova conta a vencer"** no topo da aba que abre `AddBillDueDialog` com:
- Descrição (obrigatório)
- Cliente / Pagador (opcional)
- Valor R$ (obrigatório)
- Data de vencimento (date picker — obrigatório)
- Categoria: À Vista / Mensalista (radio)
- Tipo: Receber / Pagar (radio — define `transaction_type`)
- Observações

Ao salvar, insere em `financial_transactions`:
- `transaction_type` = receipt ou expense
- `status` = pending
- `payment_status` = pendente
- `due_date` = data escolhida
- `paid_at` = null
- `payment_method` = a_vista ou a_prazo (conforme categoria)
- Descrição com tag `[MANUAL-REC:<uuid>]` ou `[MANUAL-DESP:<uuid>]` para identificar contas manuais

### Gatilho Pago / Não Pago
Na lista de contas a vencer (dentro da mesma aba):
- Switch **"Pago / Não Pago"** ao lado de cada conta.
- Ao marcar **Pago**: `paid_at = hoje`, `payment_status = 'pago'`, `status = 'completed'`.
- Ao desmarcar: `paid_at = null`, recalcula `payment_status` (`vencido` se due_date < hoje, senão `pendente`), `status = 'pending'`.
- Também adicionar botão **Editar** e **Excluir** para contas manuais.

Reflete automaticamente nos cards do topo do Financeiro (Total Recebido, A Receber, etc).

## 2. Aviso 1 dia antes do vencimento

Novo hook `src/hooks/useBillDueNotifications.ts` (padrão de `useDeadlineNotifications`):
- Consulta `financial_transactions` com `paid_at IS NULL` e `due_date` entre hoje e amanhã.
- Push notification + toast:
  - "⏰ Vence amanhã: {descrição} — R$ {valor}"
  - "🚨 Vence hoje: ..."
  - "⚠️ Atrasada há N dias: ..."
- Roda ao carregar app e a cada 1h.
- Registrado em `App.tsx`.

## 3. Totais sempre visíveis nos relatórios À Vista / Mensalistas

Editar `src/components/billing/PaymentTypeReports.tsx`:

### 3.1 Reforçar "Total Recebido" em cada card de período
Destacar o valor recebido (Semanal, Quinzenal, Mensal, Anual) com fonte maior e cor verde — métrica principal.

### 3.2 Rodapé "Resumo Recebido" por aba
Card no fim de cada aba (À Vista e Mensalistas) com:
- Recebido na semana
- Recebido na quinzena
- Recebido no mês
- Recebido no ano

### 3.3 Card consolidado "Total Geral (À Vista + Mensalistas)"
Acima do `Tabs`, sempre visível:
- Recebido semana (soma das duas categorias)
- Recebido quinzena
- Recebido mês
- Recebido ano
- **Total acumulado** no ano (destaque grande)

Mover cálculo dos períodos para o componente pai `PaymentTypeReports`, passar resultados para os filhos via props para evitar duplicação.

## Arquivos

- **editar** `src/components/billing/PaymentTypeReports.tsx` — card consolidado + rodapé por aba
- **editar** `src/components/billing/AppointmentsFinancialTab.tsx` — botão "Nova conta", lista de contas manuais, switch Pago/Não Pago, editar/excluir
- **novo** `src/components/billing/AddBillDueDialog.tsx` — formulário (criar/editar)
- **novo** `src/hooks/useBillDueNotifications.ts` — push 1 dia antes
- **editar** `src/App.tsx` — registrar hook

## Sem mudanças de schema
Tudo usa colunas existentes em `financial_transactions` (`due_date`, `paid_at`, `payment_status`, `status`, `payment_method`, `description`).
