## Objetivo

Permitir que o usuário registre se cada serviço/recebimento é **à vista** ou **a prazo (mês seguinte / data futura)**, e ver no Dashboard Financeiro:

- Quanto faturou **à vista** no mês
- Quanto tem **a receber** (a prazo / em aberto)
- Lista de **clientes bons pagadores** e **inadimplentes** automaticamente
- Tudo refletido no **relatório mensal PDF** entregue ao cliente

---

## 1. Banco de Dados (migration)

Adicionar em `services` e `financial_transactions`:

- `payment_method` (text): `'a_vista'` | `'a_prazo'`
- `due_date` (date): data prevista de recebimento (default = `service_date` para à vista; `service_date + 30 dias` para a prazo)
- `paid_at` (date, nullable): data real do pagamento
- `payment_status` (text): `'pago'` | `'pendente'` | `'vencido'` — atualizado por trigger comparando `due_date`, `paid_at` e `now()`

Atualizar trigger `sync_service_to_transaction` para propagar esses campos.

Criar função `get_client_payment_score(p_user_id, p_client_name)` que retorna:
- `total_faturas`, `pagas_em_dia`, `pagas_atraso`, `em_aberto_vencidas`
- `classificacao`: `'bom_pagador'` (≥90% em dia nos últimos 6 meses) | `'regular'` | `'inadimplente'` (tem fatura vencida há +15 dias)

## 2. Cadastro de Serviço (`ServiceForm.tsx`)

Novos campos:
- Radio: **À vista** / **A prazo**
- Se "A prazo": input de **data de vencimento** (default +30 dias)
- Botão **"Marcar como pago"** na lista de serviços, que preenche `paid_at`

## 3. Dashboard Financeiro (`Financial.tsx` + novo card)

Novo bloco no topo com 4 cards:

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Recebido à vista│ A receber (mês) │ Vencido         │ Total previsto  │
│ R$ X.XXX        │ R$ X.XXX        │ R$ X.XXX (N)    │ R$ X.XXX        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

Novo componente `ClientPaymentInsights.tsx` com duas listas lado a lado:
- 🟢 **Bons pagadores** — top clientes que sempre pagam em dia
- 🔴 **Inadimplentes** — clientes com faturas vencidas (mostra valor em aberto, dias de atraso, botão "Cobrar via WhatsApp" usando o template já existente)

## 4. Relatório Mensal PDF

Atualizar `generate-monthly-report-pdf` para incluir seção:

- **Resumo de Recebimentos**: valor à vista vs a prazo do mês
- **A Receber nos Próximos 30 dias**: tabela de faturas em aberto com vencimento
- **Alertas**: lista de inadimplentes com valor total devido

## 5. Notificações automáticas

Reaproveitar `useNotifications` para alertar:
- Quando uma fatura vence hoje
- Quando um cliente entra na lista de inadimplentes (passa de 15 dias)

---

## Arquivos a tocar

- **Migration**: novos campos + função `get_client_payment_score` + trigger de status
- `src/components/billing/ServiceForm.tsx` — campos pagamento
- `src/components/billing/ServicesList.tsx` — botão "marcar como pago", badge de status
- `src/pages/Financial.tsx` — novos cards de à vista / a receber / vencido
- `src/components/FinancialCharts.tsx` — separar série "à vista" vs "a prazo"
- **Novo**: `src/components/billing/ClientPaymentInsights.tsx`
- `supabase/functions/generate-monthly-report-pdf/index.ts` — nova seção no PDF
- `src/hooks/useNotifications.ts` — alerta de vencimento/inadimplência

## Critérios padrão (ajustáveis depois)

- A prazo padrão: **30 dias** após `service_date`
- Inadimplente: fatura **vencida há +15 dias**
- Bom pagador: **≥90% das faturas pagas até o vencimento** nos últimos 6 meses
