## Problemas

1. **Agendamento — botão "Criar/Atualizar" não aparece**
   O `DialogContent` em `src/pages/Appointments.tsx` não tem altura máxima nem rolagem. Com os novos campos (Valor do Tratamento, Forma de Pagamento, Vencimento, Pago em, etc.) o formulário ficou mais alto que a janela e o botão de salvar é cortado para fora da tela.

2. **Nova Ordem — clicar em "Criar Ordem" não salva**
   Em `src/pages/NewOrder.tsx`, o handler depende de `limits.canCreateOrder`. Enquanto o hook `useFreemiumLimits` ainda está carregando, `limits` é `undefined`, então `!limits.canCreateOrder` é `true` e o submit é abortado silenciosamente (ou mostra erro de "limite atingido" indevido). Além disso, erros do Supabase só vão para `console.error`, dificultando ver o motivo real.

## Correções

### `src/pages/Appointments.tsx`
- Adicionar `max-h-[90vh] overflow-y-auto` ao `DialogContent` para que o formulário role e o botão "Criar/Atualizar" fique sempre acessível.

### `src/pages/NewOrder.tsx`
- Bloquear o submit somente quando o hook terminou de carregar: trocar a checagem para `if (!limits.loading && !limits.canCreateOrder)`.
- Mostrar mensagem real no `toast.error` do `catch` (incluir `error.message`) para que falhas de validação/RLS apareçam para o usuário em vez de só no console.

Sem mudanças no banco, nas triggers ou em lógica de negócio — apenas os ajustes mínimos de UI/UX descritos acima.
