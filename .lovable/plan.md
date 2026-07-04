## Problema

Novos usuários abrem a página do Agente de IA sem nenhuma linha em `ai_agent_settings`. Como o `loadSettings()` só faz `select`, o estado fica vazio e ações posteriores (gerar QR, conectar Evolution) falham com "Instância não encontrada" porque não há `evolution_instance_name` persistido.

## Solução: Safe Upsert no carregamento

Ajustar `src/pages/AIAgent.tsx` (`loadSettings`) para, quando o `select` retornar `null`, inserir automaticamente uma linha padrão para o `user_id` autenticado e usá-la em seguida.

### Registro padrão inserido
- `user_id`: `user.id`
- `agent_name`: `"Assistente Virtual"`
- `is_whatsapp_enabled`: `true`
- `evolution_instance_name`: `clinic-${user.id.replace(/-/g, '').slice(0, 24)}` (mesmo formato do backend em `n8n-whatsapp-webhook`)
- Demais colunas: deixar o default do banco

### Fluxo em `loadSettings`
1. `select * from ai_agent_settings where user_id = user.id` (maybeSingle).
2. Se `data` existir → comportamento atual.
3. Se `data` for `null`:
   - `insert` da linha padrão com `.select().single()`.
   - Em caso de conflito (corrida entre abas), tratar como benigno e re-executar o `select`.
   - Preencher `settings`, `trialStartedAt`, `isConfigured` com o registro recém-criado (isConfigured = false, pois nome é o default).
4. `setLoading(false)` no `finally`.

### Detalhes técnicos
- Somente frontend; nenhuma mudança de schema, RLS ou edge function (a policy de INSERT em `ai_agent_settings` já permite `auth.uid() = user_id`).
- Reutilizar o helper de instância inline (uma linha) para manter consistência com `handleQuickSetup` (linha 159) e com o webhook.
- Não alterar `handleQuickSetup` nem a lógica de trial — o upsert só garante existência da linha.
- Logar erro de insert no console e mostrar toast discreto apenas se falhar (não bloquear tela).

### Arquivos afetados
- `src/pages/AIAgent.tsx` — função `loadSettings` (linhas ~102-136).

### Validação
- Novo usuário abre `/ai-agent` → linha aparece em `ai_agent_settings` com `evolution_instance_name` correto e `is_whatsapp_enabled = true`.
- Clique em conectar WhatsApp deixa de retornar "Instância não encontrada".
- Usuários existentes continuam carregando normalmente (branch do `data` existente inalterado).
