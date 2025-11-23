# Configuração de Envio Automático de Relatórios

Este documento explica como configurar o envio automático de relatórios mensais por email e WhatsApp.

## 1. Configurar a Edge Function

A edge function `send-scheduled-reports` já foi criada e será deployada automaticamente.

## 2. Habilitar Extensões no Supabase

Para executar a função automaticamente, você precisa habilitar as extensões `pg_cron` e `pg_net`:

1. Acesse o backend do projeto (botão "View Backend" no chat)
2. Vá para **Database** → **Extensions**
3. Procure e habilite:
   - `pg_cron` - Para agendamento de tarefas
   - `pg_net` - Para fazer requisições HTTP

## 3. Criar o Cron Job

Execute o seguinte SQL no backend (Database → SQL Editor):

```sql
-- Agendar execução diária às 8h da manhã (horário UTC)
select cron.schedule(
  'send-scheduled-reports-daily',
  '0 8 * * *', -- Diariamente às 8:00 UTC (5:00 AM horário de Brasília)
  $$
  select
    net.http_post(
        url:='https://idotyktgeqkpsypmztrg.supabase.co/functions/v1/send-scheduled-reports',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkb3R5a3RnZXFrcHN5cG16dHJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTEzNDEsImV4cCI6MjA3NzIyNzM0MX0.o-7i0DdmsqmDOvzrK5z8Pqw2qa5UyojeXV_5J8c_gvY"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
```

## 4. Verificar Cron Jobs

Para verificar os cron jobs configurados, execute:

```sql
SELECT * FROM cron.job;
```

## 5. Como Funciona

1. **Configuração**: Os usuários configuram quais clientes devem receber relatórios automáticos na aba "Envios Automáticos" do Faturamento
2. **Agendamento**: Definem o dia do mês (1-28) em que o relatório deve ser enviado
3. **Execução**: Todos os dias às 8h UTC, a função verifica se há agendamentos para o dia atual
4. **Envio**: Para cada agendamento ativo, a função:
   - Busca os serviços do mês anterior para aquele cliente
   - Gera o relatório HTML
   - Envia por email (se configurado)
   - Registra o envio no histórico

## 6. Ajustar Horário (Opcional)

Para mudar o horário de execução, modifique a expressão cron:

- `0 8 * * *` - 8:00 AM UTC (5:00 AM Brasília)
- `0 12 * * *` - 12:00 PM UTC (9:00 AM Brasília)
- `0 0 * * *` - 00:00 AM UTC (21:00 do dia anterior em Brasília)

## 7. Logs e Monitoramento

Para ver os logs da função:
1. Acesse o backend
2. Vá para **Edge Functions** → **send-scheduled-reports**
3. Veja a aba **Logs**

## 8. Desabilitar Envio Automático

Para pausar o envio automático sem deletar os agendamentos:
1. Os usuários podem desativar agendamentos individuais usando o switch na lista
2. Para desabilitar completamente o cron job:

```sql
SELECT cron.unschedule('send-scheduled-reports-daily');
```

## Observações Importantes

- O relatório enviado é sempre do **mês anterior**
- Dias acima de 28 não são permitidos para evitar problemas em fevereiro
- É necessário ter o **RESEND_API_KEY** configurado nos secrets
- Os envios são registrados na tabela `report_history`
- O último envio é registrado em `last_sent_at` na tabela de agendamentos
