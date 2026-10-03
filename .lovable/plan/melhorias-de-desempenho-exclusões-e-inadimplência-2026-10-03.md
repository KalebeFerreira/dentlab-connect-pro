# Melhorias de desempenho, exclusões e inadimplência

## Objetivo
Deixar o sistema mais leve no celular, reduzir leituras e chamadas desnecessárias, corrigir clientes que continuam como inadimplentes após o pagamento e oferecer **Arquivar/Restaurar** para os cadastros do usuário sem perder histórico.

## 1. Corrigir inadimplência após pagamento
- Sincronizar o pagamento entre Faturamento e Financeiro, independentemente da tela onde ele for registrado.
- Atualizar a classificação imediatamente após marcar como pago, sem apagar o histórico do cliente.
- Manter vermelho apenas para valores realmente abertos e vencidos; pagamentos quitados deixam de contar como inadimplência.
- Atualizar listas, cartões e relatórios após a quitação.

## 2. Arquivar e restaurar cadastros
- Adicionar **Arquivar** nas áreas de pacientes, clientes do faturamento, serviços, ordens, funcionários, dentistas e demais cadastros editáveis.
- Criar uma visualização de **Arquivados** com ação de restauração.
- Manter vínculos financeiros, clínicos e operacionais ao arquivar.
- Para anotações, mensagens e arquivos sem dependências importantes, manter opção de exclusão permanente com confirmação clara.
- Substituir exclusões permanentes atuais de cadastros com histórico pelo arquivamento seguro.

## 3. Clientes na página Faturamento
- Adicionar Arquivar/Restaurar na lista de clientes.
- Ocultar clientes arquivados das listas ativas e dos seletores de novos lançamentos.
- Preservar serviços, pagamentos e relatórios anteriores.
- Evitar que um perfil arquivado continue gerando alerta ativo de inadimplência.

## 4. Desempenho mobile e consumo
- Remover atualizações duplicadas em tempo real nas páginas de pedidos e painel.
- Buscar somente colunas necessárias e limitar/paginar listas extensas.
- Carregar geradores de PDF, Excel e recursos pesados apenas quando o usuário solicitar exportação.
- Evitar recarregar listas completas após pequenas alterações; atualizar apenas o item afetado quando possível.
- Revisar notificações e listeners globais para impedir chamadas repetidas em segundo plano.

## 5. Validação
- Testar no celular os fluxos de abrir listas, arquivar, restaurar, pagar e remover anotações.
- Confirmar que um pagamento feito em Financeiro remove o alerta no Faturamento e vice-versa.
- Confirmar que cadastros arquivados não aparecem nas listas ativas, mas continuam nos relatórios históricos.
- Comparar chamadas de rede e tempo de carregamento antes/depois nas páginas principais.

## Detalhes técnicos
- Adicionar estado de arquivamento às entidades que ainda não o possuem, com regras de acesso restritas ao proprietário.
- Ajustar a função de classificação de clientes e criar sincronização bidirecional entre serviços e transações vinculadas.
- Preservar registros relacionados e impedir cascatas destrutivas em pacientes, ordens e funcionários.
- Aplicar índices somente onde as consultas medidas demonstrarem necessidade.
- Executar as mudanças em blocos verificáveis: banco e inadimplência; arquivamento; desempenho; testes finais.
