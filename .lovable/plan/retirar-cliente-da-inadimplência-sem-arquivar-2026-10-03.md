# Retirar cliente da inadimplência sem arquivar

## Objetivo
Permitir que o usuário retire um cliente da lista de inadimplentes diretamente no aviso vermelho, sem arquivar ou ocultar o cliente.

## Alterações
- Adicionar **Marcar como pago** em cada cliente exibido na área **Inadimplentes**, ao lado de **Cobrar**.
- Exibir uma confirmação informando a quantidade e o valor total das cobranças vencidas que serão quitadas.
- Ao confirmar, marcar como pagas todas as cobranças vencidas e ainda abertas daquele cliente.
- Manter o cadastro, serviços, relatórios e histórico do cliente ativos e visíveis.
- Atualizar automaticamente o Financeiro, o Faturamento, os cartões e a classificação após a quitação.
- Remover imediatamente o cliente do aviso vermelho quando não restar cobrança vencida aberta.
- Manter **Arquivar cliente** como uma ação separada, usada somente quando o usuário quiser ocultar o cadastro ativo.

## Segurança e consistência
- Restringir a quitação aos lançamentos pertencentes ao usuário conectado e ao cliente selecionado.
- Usar a data atual como data de pagamento.
- Preservar os valores e registros originais; nenhuma cobrança será apagada.
- Evitar atualizações parciais: se a quitação falhar, mostrar o erro e manter o alerta.

## Validação
- Testar um cliente com uma e com várias cobranças vencidas.
- Confirmar que serviços e lançamentos financeiros ficam como pagos sem duplicação.
- Confirmar que o cliente permanece ativo na página Clientes e nos relatórios.
- Confirmar que o aviso vermelho desaparece sem arquivamento.
