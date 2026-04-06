import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";

interface WorkRecord {
  id: string;
  work_type: string;
  patient_name: string | null;
  value: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  color: string | null;
}

interface Props {
  records: WorkRecord[];
  employeeName: string;
  monthLabel: string;
  totalValue: number;
  finishedCount: number;
  inProgressCount: number;
}

const statusLabel = (s: string) =>
  s === "finished" ? "Finalizado" : s === "in_progress" ? "Em Andamento" : "Pendente";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const EmployeeMonthlyReportExport = ({
  records, employeeName, monthLabel, totalValue, finishedCount, inProgressCount,
}: Props) => {
  const [exporting, setExporting] = useState(false);

  const filePrefix = `relatorio-mensal-${employeeName.toLowerCase().replace(/\s+/g, "-")}-${monthLabel.replace(/\s+/g, "-")}`;

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Mensal", pw / 2, y, { align: "center" });
      y += 7;
      doc.setFontSize(12);
      doc.text(employeeName, pw / 2, y, { align: "center" });
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(monthLabel, pw / 2, y, { align: "center" });
      y += 10;

      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 4, pw - 28, 14, "F");
      doc.setFontSize(9);
      doc.text(`Total: ${records.length} trabalhos | Finalizados: ${finishedCount} | Em andamento: ${inProgressCount} | Valor: ${currency(totalValue)}`, 18, y + 4);
      y += 18;

      // Table header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(230, 230, 230);
      doc.rect(14, y - 4, pw - 28, 7, "F");
      const cols = [14, 48, 82, 100, 126, 154, 178];
      const headers = ["Tipo", "Paciente", "Cor", "Valor", "Status", "Entrada", "Finalização"];
      headers.forEach((h, i) => doc.text(h, cols[i], y));
      y += 6;

      doc.setFont("helvetica", "normal");
      for (const r of records) {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text((r.work_type || "").substring(0, 18), cols[0], y);
        doc.text((r.patient_name || "-").substring(0, 18), cols[1], y);
        doc.text(r.color || "-", cols[2], y);
        doc.text(r.value ? currency(r.value) : "-", cols[3], y);
        doc.text(statusLabel(r.status), cols[4], y);
        doc.text(format(new Date(r.start_date), "dd/MM/yy"), cols[5], y);
        doc.text(r.end_date ? format(new Date(r.end_date), "dd/MM/yy") : "-", cols[6], y);
        y += 5;
      }

      // Total row
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.text(`Total do mês: ${currency(totalValue)}`, 14, y);

      doc.save(`${filePrefix}.pdf`);
      toast.success("PDF exportado!");
    } catch {
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportToWord = () => {
    const html = `<html><head><meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; font-size: 18px; }
        h2 { text-align: center; font-size: 14px; color: #555; }
        .summary { background: #f5f5f5; padding: 10px; margin: 12px 0; border-radius: 4px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px 7px; font-size: 11px; text-align: left; }
        th { background: #eee; font-weight: bold; }
        .total-row { font-weight: bold; background: #fafafa; }
      </style></head><body>
      <h1>Relatório Mensal - ${employeeName}</h1>
      <h2>${monthLabel}</h2>
      <div class="summary">
        <strong>Resumo:</strong> ${records.length} trabalhos | ${finishedCount} finalizados | ${inProgressCount} em andamento | Valor: ${currency(totalValue)}
      </div>
      <table>
        <tr><th>Tipo</th><th>Paciente</th><th>Cor</th><th>Valor</th><th>Status</th><th>Entrada</th><th>Finalização</th></tr>
        ${records.map(r => `<tr>
          <td>${r.work_type}</td>
          <td>${r.patient_name || "-"}</td>
          <td>${r.color || "-"}</td>
          <td>${r.value ? currency(r.value) : "-"}</td>
          <td>${statusLabel(r.status)}</td>
          <td>${format(new Date(r.start_date), "dd/MM/yyyy")}</td>
          <td>${r.end_date ? format(new Date(r.end_date), "dd/MM/yyyy") : "-"}</td>
        </tr>`).join("")}
        <tr class="total-row"><td colspan="3">Total do Mês</td><td>${currency(totalValue)}</td><td colspan="3">${finishedCount} finalizados</td></tr>
      </table></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filePrefix}.doc`;
    a.click();
    toast.success("Word exportado!");
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Relatório Mensal");

      // Title
      ws.mergeCells("A1:G1");
      ws.getCell("A1").value = `Relatório Mensal - ${employeeName}`;
      ws.getCell("A1").font = { bold: true, size: 14 };
      ws.getCell("A1").alignment = { horizontal: "center" };

      ws.mergeCells("A2:G2");
      ws.getCell("A2").value = monthLabel;
      ws.getCell("A2").font = { size: 11, italic: true };
      ws.getCell("A2").alignment = { horizontal: "center" };

      // Summary
      ws.mergeCells("A3:G3");
      ws.getCell("A3").value = `Total: ${records.length} | Finalizados: ${finishedCount} | Em andamento: ${inProgressCount} | Valor: ${currency(totalValue)}`;
      ws.getCell("A3").font = { size: 10 };
      ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

      // Headers
      const headerRow = ws.addRow(["Tipo", "Paciente", "Cor", "Valor", "Status", "Entrada", "Finalização"]);
      headerRow.font = { bold: true };
      headerRow.eachCell(c => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
        c.border = { bottom: { style: "thin" } };
      });

      // Data
      for (const r of records) {
        ws.addRow([
          r.work_type,
          r.patient_name || "-",
          r.color || "-",
          r.value || 0,
          statusLabel(r.status),
          format(new Date(r.start_date), "dd/MM/yyyy"),
          r.end_date ? format(new Date(r.end_date), "dd/MM/yyyy") : "-",
        ]);
      }

      // Total
      const totalRow = ws.addRow(["Total do Mês", "", "", totalValue, `${finishedCount} finalizados`, "", ""]);
      totalRow.font = { bold: true };

      // Column widths
      ws.columns = [
        { width: 22 }, { width: 22 }, { width: 10 }, { width: 14 },
        { width: 14 }, { width: 13 }, { width: 13 },
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filePrefix}.xlsx`;
      a.click();
      toast.success("Excel exportado!");
    } catch {
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };

  if (records.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToWord}>
          <FileText className="h-4 w-4 mr-2" /> Word
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
