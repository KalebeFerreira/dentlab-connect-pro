## Exportação de Relatórios Detalhados (À Vista / Mensalistas por período)

Adicionar exportação por aba (À Vista e Mensalistas) com seletor de período (Semanal, Quinzenal, Mensal, Anual) em `src/components/billing/PaymentTypeReports.tsx`.

### Onde
No topo de cada `CategoryReport` (dentro das abas À Vista e Mensalistas), adicionar uma barra com:
- Select de período: Semanal / Quinzenal / Mensal / Anual
- Botão **Exportar PDF**
- Botão **Exportar Excel (CSV)**
- Botão **Imprimir**

### O que o relatório contém
- Cabeçalho: categoria (À Vista ou Mensalistas), período escolhido, data de geração, nome da empresa (de `company_info`)
- Resumo do período: Recebido, A receber, Vencido, Despesas, Lucro
- Tabela detalhada de transações no período: cliente/paciente, data, vencimento, valor, status (Recebido/Pendente/Vencido)
- Tabela agregada por cliente: nº de transações, recebido, pendente, vencido, total
- Totais finais

### Como
- **PDF**: reaproveitar `src/lib/pdfGenerator.ts` (`generatePDF` com div oculto) — padrão já usado no projeto. Nome: `relatorio-{categoria}-{periodo}-{data}.pdf`.
- **CSV**: gerar string CSV e disparar download via `Blob` + `<a download>`. Nome: `relatorio-{categoria}-{periodo}-{data}.csv`.
- **Imprimir**: `window.print()` em um container dedicado com classe `print:block`.

### Arquivos
- **editar** `src/components/billing/PaymentTypeReports.tsx` — adicionar estado `exportPeriod`, barra de ações, funções `exportPDF()`, `exportCSV()`, `handlePrint()`, e div oculto com layout do relatório para o PDF.
- **novo** `src/lib/reportExport.ts` (opcional) — helpers `buildCsv(rows)` e `triggerDownload(blob, name)` para reuso futuro.

### Sem mudanças de schema nem novas dependências
Usa `jsPDF` + `html2canvas` já instalados via `pdfGenerator.ts`.
