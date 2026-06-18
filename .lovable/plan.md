Vou ajustar o relatório PDF mensal para ficar exatamente como você pediu: somente os trabalhos listados/detalhados, sem dados extras.

Plano:
1. Remover do PDF os cartões/resumos de valores como “Recebido à vista”, “A receber”, “Vencido” e “Total geral”.
2. Remover do cabeçalho do relatório informações extras como “Filtro aplicado”, mantendo no máximo período e quantidade de serviços.
3. Simplificar a coluna “Pagamento” para não mostrar frases com datas, como “A receber até dia X” ou “Vencido em dia X”. Ela mostrará apenas algo simples, por exemplo: “Pago”, “A receber” ou “Vencido”.
4. Manter apenas a listagem detalhada dos trabalhos: clínica, serviço, paciente, data, status simples de pagamento e valor.
5. Manter o total final apenas como soma dos trabalhos que aparecem no relatório filtrado.

Arquivo a alterar:
- `supabase/functions/generate-monthly-report-pdf/index.ts`

Resultado esperado:
- Se você gerar relatório de “A receber”, aparecerão somente os trabalhos desse filtro, sem resumo de outros status e sem “pagar/receber até dia X”.
- Se gerar “Pagos à vista”, aparecerão somente esses trabalhos.
- Se gerar “Vencidos”, aparecerão somente esses trabalhos, sem especificar data de vencimento no texto.