## Objetivo
Adicionar no dashboard de **Faturamento** uma seção que separa os clientes por tipo de pagamento (**À vista** vs **Mensalista**), permitindo que o próprio usuário marque/edite essa classificação manualmente. É apenas informativo (controle do usuário), não altera lançamentos financeiros.

## O que será criado

### 1. Tabela nova: `client_payment_profiles`
Armazena a classificação manual por cliente (por usuário).
- `user_id` (dono)
- `client_name` (chave junto com user_id)
- `payment_type` enum: `a_vista` | `mensalista` | `nao_definido`
- `notes` (opcional, texto curto)
- RLS: cada usuário só vê/edita os seus.

### 2. Componente novo: `src/components/billing/ClientPaymentCategories.tsx`
Card no dashboard de Faturamento mostrando:

```text
┌─────────────────────────────────────────────┐
│ Clientes À Vista (12)   │ Mensalistas (8)   │
├─────────────────────────┼───────────────────┤
│ • João Silva            │ • Clínica Sorriso │
│ • Maria Costa           │ • Dr. Pedro       │
│ ...                     │ ...               │
├─────────────────────────┴───────────────────┤
│ ⚠ Sem classificação (5)  [Classificar →]    │
└─────────────────────────────────────────────┘
```

- Lista os clientes vindos de `services.client_name` (distinct) do usuário.
- Faz `left join` com `client_payment_profiles` para mostrar a categoria atual.
- Cada cliente tem um **select inline** (À vista / Mensalista / Não definido) que salva direto na tabela via upsert.
- Mostra contadores no topo.
- Filtro/busca por nome.

### 3. Integração em `src/pages/Billing.tsx`
- Adicionar `<ClientPaymentCategories />` como nova aba **"Clientes"** dentro do `Tabs` existente (lazy-loaded como os demais).

## O que NÃO muda
- Triggers financeiros, lançamentos de receita/despesa, métodos de pagamento das services — nada disso é tocado. É só uma camada informativa de controle.
- Não altera `services.payment_method` (que é por venda); a classificação aqui é por cliente.

## Detalhes técnicos
- Migration cria tabela + GRANTs (`authenticated`, `service_role`) + RLS (`auth.uid() = user_id` em todas as policies) + trigger `update_updated_at_column`.
- Após migration aprovada, types são regenerados e aí o componente é escrito.

## Arquivos
- **Novo:** `supabase/migrations/...` (tabela `client_payment_profiles`)
- **Novo:** `src/components/billing/ClientPaymentCategories.tsx`
- **Editado:** `src/pages/Billing.tsx` (nova aba "Clientes")
