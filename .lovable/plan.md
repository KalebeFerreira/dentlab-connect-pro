
# Diagnóstico Arquitetural — Plataforma Multiclínica WhatsApp

## 1. Análise de aderência multi-tenant

**Modelo atual (real, lido do banco e das Edge Functions):**
- Não existe entidade `clinics`. O "tenant" é o `auth.users.id` (o `user_id` que aparece em todas as tabelas: `ai_agent_settings`, `whatsapp_conversations`, `whatsapp_messages`, `appointments`, `patients`, `message_history`, etc.).
- `ai_agent_settings` opera como **1 usuário = 1 agente = 1 instância Evolution**. Não há suporte nativo a múltiplos agentes por clínica, nem múltiplos números.
- O roteamento multi-tenant do webhook n8n → Supabase depende de:
  1. `user_id` explícito no payload (ideal, vindo do querystring `?clinicaId=` que o `evolution-manager` grava no webhook),
  2. lookup por `instance_name` (`clinic-${userId sem hífens, 24 chars}`),
  3. lookup pelo histórico da conversa (`whatsapp_conversations.phone_number`),
  4. **fallback perigoso**: "primeiro agente com WhatsApp habilitado" (`n8n-whatsapp-webhook` linhas ~574-583) — em produção multi-clínica isso **rotearia mensagens para a clínica errada** se qualquer um dos 3 primeiros lookups falhar.
- RLS está por `user_id`, o que isola dados no frontend — mas a Edge Function usa `SERVICE_ROLE_KEY` e reimplementa o isolamento na mão.
- Não existe conceito de: `clinic → members (dentistas/recepção)`, `clinic → agents (N)`, `clinic → whatsapp_instances (N)`, `agent → prompts/regras/horários versionados`, `handoff_rules`, `business_hours` por agente.
- Horários, prompts e transbordo humano hoje são campos soltos em `ai_agent_settings` (um único registro por usuário) — não escala para "cada agente da clínica com seu sub-prompt".

**Gargalos estruturais:**
1. **Ausência de `clinics` como entidade** — força a equivaler "usuário Supabase" a "clínica", impedindo múltiplos operadores/dentistas dentro da mesma clínica compartilhando o mesmo agente.
2. **Fallback "primeiro agente habilitado"** no webhook — bug crítico de vazamento cross-tenant.
3. **1:1 agente↔instância↔usuário** — impede rede/franquia com várias unidades.
4. **`SYSTEM_PROMPT_BASE` hardcoded** em `n8n-whatsapp-webhook` — não é customizável por clínica/agente.
5. **Regras de handoff, horários, mensagens fora do expediente** existem só como colunas planas — não há tabela de regras condicionais.
6. **`message_history` (agendamentos) e `whatsapp_messages` (chat IA)** são silos separados — sem visão unificada de conversa.
7. **n8n no meio do caminho** adiciona latência e ponto de falha para algo que a Edge Function já faz sozinha (normalização, validação, roteamento, resposta).

## 2. Refatorar vs. Reconstruir

**Recomendação: REFATORAR de forma incremental.** Reconstruir do zero é desnecessário e arriscado.

**Justificativa objetiva:**
- O código já tem ~90% das peças certas: RLS por `user_id`, `evolution-manager` multi-tenant (instância por usuário), webhook que já tenta roteamento por 3 caminhos, tabelas de conversas/mensagens/pacientes/agendamentos maduras.
- O que falta é **uma camada de abstração `clinic`** acima de `user_id` e **normalizar o modelo de agentes/instâncias para N:N**. Isso é aditivo — não quebra o produto existente se feito com views/compatibilidade.
- Reconstruir jogaria fora: integrações Stripe, financeiro, fiscal (NFS-e), pacientes, agendamentos, laboratório, autenticação, RLS madura. Isso é 80% do valor do sistema e **não tem nada de errado**.
- O único ponto onde "reconstruir" faria sentido seria o pipeline n8n → webhook. E mesmo aí, a resposta certa é **simplificar (remover n8n)**, não reescrever tudo.

## 3. Plano de ação — Refatoração incremental

### Fase 1 — Estancar o sangramento (1 dia, alto impacto)
1. **Remover o fallback "primeiro agente habilitado"** em `supabase/functions/n8n-whatsapp-webhook/index.ts` (linhas ~574-583). Se `user_id`, `instance_name` e histórico falharem, retornar 404 explícito. Melhor perder mensagem do que rotear cross-tenant.
2. **Tornar `clinicaId` (=`user_id`) obrigatório** no querystring do webhook e validar no início do handler.
3. **Garantir `ai_agent_settings.evolution_instance_name` UNIQUE** via migration (proteção contra colisão).

### Fase 2 — Introduzir entidade `clinics` sem quebrar nada (2-3 dias)
Novas tabelas (aditivas):
- `clinics` (id, owner_user_id, name, timezone, created_at)
- `clinic_members` (clinic_id, user_id, role: `owner|admin|reception|dentist`)
- Backfill: `INSERT INTO clinics SELECT gen_random_uuid(), user_id, name FROM profiles` + `clinic_members` com role=owner.
- Adicionar `clinic_id` (nullable inicialmente) em: `ai_agent_settings`, `whatsapp_conversations`, `whatsapp_messages`, `appointments`, `patients`. Preencher via trigger a partir de `user_id`.
- Novas RLS policies via `has_clinic_access(clinic_id)` (security definer, análogo a `has_role`).
- Frontend continua usando `user_id` — nenhuma tela quebra.

### Fase 3 — Múltiplos agentes/instâncias por clínica (3-5 dias)
- Nova tabela `agents` (id, clinic_id, name, system_prompt, personality, working_hours, handoff_rules jsonb, is_active).
- Nova tabela `whatsapp_instances` (id, clinic_id, agent_id, evolution_instance_name UNIQUE, phone_number, status, connected_at).
- Migrar `ai_agent_settings` → view de compatibilidade sobre `agents` + `whatsapp_instances`.
- Roteamento do webhook passa a ser: `instance_name → whatsapp_instances → agent → clinic`. Sem ambiguidade.
- `SYSTEM_PROMPT_BASE` deixa de ser hardcoded; vem de `agents.system_prompt` com placeholders (`{clinic_name}`, `{business_hours}`).

### Fase 4 — Simplificar pipeline (opcional, 1-2 dias)
- Apontar Evolution API webhook direto para `n8n-whatsapp-webhook` (já é o padrão em `evolution-manager`). Manter n8n **apenas** para automações que exigem visual (ex: integrações externas). Todo o fluxo "recebeu → normaliza → valida → responde" já vive na Edge Function.
- Ganhos: -1 hop de latência, -1 ponto de falha, -1 lugar para debugar.

### Fase 5 — Handoff humano e horários por agente (2 dias)
- Tabela `handoff_events` (conversation_id, reason, assigned_to_user_id, resolved_at).
- Regras condicionais (`handoff_rules` jsonb em `agents`): palavras-chave, sentimento, fora de horário, N tentativas sem resolução.
- UI em `WhatsAppInbox.tsx` para "assumir conversa" (freeze da IA por X minutos).

### Arquitetura alvo (visão)

```text
Frontend (React)
   │  (auth: supabase user → clinic_members → clinic)
   ▼
Supabase
   ├── clinics ──┬── clinic_members (user_id, role)
   │             ├── agents (N por clínica, prompt/regras/horário)
   │             ├── whatsapp_instances (N por clínica, 1:1 com agent)
   │             ├── whatsapp_conversations (clinic_id, agent_id, phone)
   │             ├── whatsapp_messages
   │             ├── handoff_events
   │             ├── patients / appointments / financial…  (todos com clinic_id)
   │             └── RLS via has_clinic_access(clinic_id)
   │
   └── Edge Functions
        ├── evolution-manager  (cria instância por clínica+agente)
        ├── n8n-whatsapp-webhook  (roteia via instance_name → agent)
        └── ai-whatsapp  (usa agent.system_prompt dinâmico)
                   │
                   ▼
             Evolution API  ↔  WhatsApp
```

### Detalhes técnicos (para o time de dev)
- Toda migration segue o padrão: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY.
- Função `has_clinic_access(_user_id uuid, _clinic_id uuid)` como SECURITY DEFINER análoga a `has_role`, para evitar recursão em policies.
- Colunas `clinic_id` entram como `NULL` + backfill + `NOT NULL` numa segunda migration (zero downtime).
- Views `ai_agent_settings_compat` para não quebrar `src/pages/AIAgent.tsx` enquanto o frontend não é migrado.
- Nenhum dado é perdido; hoje `clinic ≡ user`, então o backfill é 1:1 trivial.

### O que NÃO fazer
- Não reescrever `evolution-manager` — está sólido.
- Não jogar fora `whatsapp_conversations`/`messages` — só adicionar `clinic_id`/`agent_id`.
- Não migrar frontend e backend no mesmo PR. Backend primeiro (com view compat), frontend depois.

## Resumo executivo
Refatorar em 5 fases (~2 semanas de dev focado). Fase 1 é urgente (bug de vazamento cross-tenant no fallback do webhook). Fases 2-3 destravam o "multi-clínica de verdade" (rede, franquia, múltiplos agentes). Fase 4 remove n8n do caminho crítico. Reconstruir do zero custaria 2-3 meses e jogaria fora Stripe/fiscal/financeiro/agendamentos que já funcionam.
