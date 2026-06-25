## Problema

No `/billing`, ao clicar no lápis de um serviço cadastrado, o diálogo de edição (`EditServiceDialog`) abre, mas no viewport atual (~922×588) o conteúdo do formulário ultrapassa a altura da tela. Como o `DialogContent` não tem `max-height` nem rolagem interna, os campos do meio/fim (forma de pagamento, vencimento, data de pagamento) e principalmente os botões **Cancelar / Salvar Alterações** ficam fora da área visível e inalcançáveis — dando a sensação de que "não há opção de alterar nada nem salvar".

## Correção

Ajustar apenas o `EditServiceDialog` (sem mexer na lógica de salvamento, que já funciona):

1. Limitar a altura do `DialogContent` (`max-h-[90vh]`) e transformar seu interior em layout flex em coluna.
2. Mover o `<form>` para dentro de um wrapper rolável (`overflow-y-auto`, `flex-1`, `pr-1` para não esconder a scrollbar) para que todos os campos fiquem acessíveis em telas pequenas/médias.
3. Manter o rodapé com **Cancelar / Salvar Alterações** fixo (`sticky bottom-0 bg-background border-t pt-3`) sempre visível, independente da rolagem.
4. Garantir `pointer-events-auto` no conteúdo para que os inputs (incluindo datas) recebam interação normalmente dentro do modal.

Nenhuma alteração em schema, edge functions, ou na regra de negócio de atualização do serviço — apenas presentation/UX no componente do diálogo.

## Arquivo afetado

- `src/components/billing/EditServiceDialog.tsx` (somente layout do `DialogContent` / `DialogFooter`).

## Verificação

- Abrir Faturamento → clicar no lápis de um serviço.
- Conferir no viewport 922×588 que: todos os campos aparecem (com rolagem se necessário) e os botões **Cancelar** e **Salvar Alterações** continuam visíveis no rodapé.
- Alterar data do serviço, forma de pagamento e valor → clicar em **Salvar Alterações** → toast de sucesso e lista atualizada.
