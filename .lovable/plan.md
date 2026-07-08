# Plano — Blindar o disparo do WhatsApp na Edge Function

## Diagnóstico
`sendWhatsAppReply` hoje devolve apenas `boolean`. Quando algo falha (fetch rejeitado, 401, 404, timeout, DNS), o erro só aparece via `console.error` — mas o JSON de resposta ao n8n perde totalmente a causa, e nada garante que o log tenha sido flushado antes do `return`. Também não há timeout: um fetch travado pode fazer a Edge Function encerrar por wall-clock antes do log sair, dando a impressão de "falha silenciosa".

## Objetivo
Toda resposta com `whatsapp_sent: false` precisa carregar `whatsapp_error_details` explicando exatamente o que aconteceu, e os logs do Supabase precisam mostrar a URL final, status HTTP e corpo de erro da Evolution.

## Mudanças na Edge Function `n8n-whatsapp-webhook`

### 1. `sendWhatsAppReply` passa a retornar um resultado estruturado
Novo tipo:
```ts
type SendResult =
  | { ok: true; status: number; providerResponse: string }
  | { ok: false; stage: 'config'|'fetch'|'http'|'timeout'; status?: number; error: string; url?: string; providerBody?: string };
```
- Valida config e retorna `{ ok:false, stage:'config', error:'missing X,Y' }` listando exatamente quais campos faltam (token, url, instance, phone, message).
- Loga `url`, `instanceName`, `numberNormalizado`, `msgLen` antes do fetch.
- `AbortController` com timeout de 10s → em timeout retorna `{ ok:false, stage:'timeout' }`.
- Try/catch envolvendo o `fetch`:
  - Erro de rede/DNS → `{ ok:false, stage:'fetch', error: err.message }`.
  - `!resp.ok` → lê body (até 800 chars), loga `status + body`, retorna `{ ok:false, stage:'http', status, providerBody }`.
  - OK → `{ ok:true, status, providerResponse: body.slice(0,300) }`.
- Todo `console.error/log` usa prefixo `[sendWhatsAppReply]` para facilitar `grep`.

### 2. Chamadas passam a ser `await`-adas e o resultado é propagado
Nos três pontos de chamada (aprox. linhas 511, 789, 924):
- Substituir `const sent = await sendWhatsAppReply(...)` (booleano) por `const sendResult = await sendWhatsAppReply(...)`.
- Antes de qualquer `return new Response(...)`, garantir que `await` ocorreu — nada de disparar e retornar em paralelo.
- Se o handler já estava embrulhado em `try/catch`, adicionar `catch` local ao redor da chamada só para transformar exceção inesperada em `SendResult` de fallback (nunca deixar o handler cair silenciosamente).

### 3. JSON de resposta enriquecido
Todo `return new Response(JSON.stringify({ success: true, whatsapp_sent: sent }))` vira:
```ts
return new Response(JSON.stringify({
  success: true,
  whatsapp_sent: sendResult.ok,
  whatsapp_status: sendResult.ok ? sendResult.status : sendResult.status ?? null,
  whatsapp_error_details: sendResult.ok ? null : {
    stage: sendResult.stage,
    error: sendResult.error,
    provider_body: sendResult.providerBody ?? null,
    url: sendResult.url ?? null,
  },
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```
Aplicar o mesmo shape nos três returns (fluxo normal, fora-de-horário, teste manual).

### 4. Log de "checkpoint" no wrapper principal
No `serve(async (req) => { ... })`, envolver o bloco final com `try/catch` que loga `[webhook] fatal:` antes de retornar 500 — para que qualquer exceção não-tratada apareça no Supabase mesmo se ocorrer depois do `sendWhatsAppReply`.

### 5. Sem mudanças em outros arquivos
Frontend/n8n não precisam ser alterados; passam apenas a receber `whatsapp_error_details` quando o disparo falhar. Nenhuma migration.

## Como validar após aplicar
1. Reenviar uma mensagem de teste pelo WhatsApp.
2. No log da Edge Function, procurar `[sendWhatsAppReply] POST` e a linha `ok → ...` ou `Evolution <status>`.
3. Se `whatsapp_sent:false`, o próprio JSON de resposta agora diz o motivo (`stage` + `error` + `provider_body`) — sem depender só do log.

## Fora de escopo
- Não mudar autenticação, checagem de assinatura, roteamento por `instance_name`, nem parse de datas.
- Não alterar `evolution-manager` nem tabelas.
