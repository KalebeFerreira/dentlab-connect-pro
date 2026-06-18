Vou ajustar o relatório gerado para cliente para exibir somente os trabalhos executados, sem informações de cobrança/controle interno.

Plano:
1. Em `supabase/functions/generate-monthly-report-pdf/index.ts`, remover do HTML do PDF qualquer coluna ou texto de status de pagamento: `Pagamento`, `Pago`, `A receber`, `Vencido`.
2. Deixar a tabela do PDF apenas com dados do trabalho: `Serviço`, `Paciente`, `Data` e `Valor`.
3. Trocar os totais com nomes financeiros internos, como `Total Recebido à Vista`, `Total Não Pagas` e `Total Vencido`, para um texto neutro: `Total do Relatório`.
4. Remover do rodapé a frase `relatório gerencial`, para não parecer relatório interno de controle.
5. Manter o filtro funcionando apenas para selecionar quais trabalhos entram no relatório, mas sem mostrar esse filtro/status no documento final.

Resultado esperado: mesmo escolhendo `A receber`, `Vencidas` ou `Pagas à vista`, o PDF enviado ao cliente mostrará somente a lista detalhada dos trabalhos filtrados, sem cobrança, vencimento ou instruções de pagamento.