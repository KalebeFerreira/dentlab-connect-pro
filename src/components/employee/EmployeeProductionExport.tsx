import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Image } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";

interface WorkRecord {
  id: string;
  work_type: string;
  patient_name: string | null;
  value: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  deadline: string | null;
  color: string | null;
  notes: string | null;
}

interface EmployeeProductionExportProps {
  workRecords: WorkRecord[];
  employeeName: string;
}

export const EmployeeProductionExport = ({ workRecords, employeeName }: EmployeeProductionExportProps) => {
  const [exporting, setExporting] = useState(false);

  const totalValue = workRecords.reduce((sum, r) => sum + (r.value || 0), 0);
  const finishedCount = workRecords.filter(r => r.status === "finished").length;

  const buildHtmlTable = () => {
    let html = `
      <html><head><meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
        h1 { text-align: center; color: #333; font-size: 18px; }
        .summary { background: #f5f5f5; padding: 12px; margin-bottom: 16px; border-radius: 5px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        .total { font-weight: bold; background: #fafafa; }
      </style></head><body>
      <h1>Relatório de Produção - ${employeeName}</h1>
      <p style="text-align:center;font-size:12px;color:#666;">Gerado em ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
      <div class="summary">
        <strong>Resumo:</strong> ${workRecords.length} trabalhos | ${finishedCount} finalizados | 
        Valor Total: ${totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </div>
      <table><tr><th>Tipo</th><th>Paciente</th><th>Cor</th><th>Valor</th><th>Status</th><th>Data</th></tr>`;

    for (const r of workRecords) {
      html += `<tr>
        <td>${r.work_type}</td>
        <td>${r.patient_name || "-"}</td>
        <td>${r.color || "-"}</td>
        <td>${r.value ? r.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</td>
        <td>${r.status === "finished" ? "Finalizado" : r.status === "in_progress" ? "Em Andamento" : "Pendente"}</td>
        <td>${format(new Date(r.start_date), "dd/MM/yyyy")}</td>
      </tr>`;
    }

    html += `<tr class="total"><td colspan="3">Total</td><td>${totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td colspan="2">${finishedCount} finalizados</td></tr>`;
    html += `</table></body></html>`;
    return html;
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Relatório de Produção - ${employeeName}`, pw / 2, y, { align: "center" });
      y += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy")}`, pw / 2, y, { align: "center" });
      y += 12;

      doc.text(`Total: ${workRecords.length} trabalhos | Finalizados: ${finishedCount} | Valor: ${totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, 14, y);
      y += 10;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Tipo", 14, y); doc.text("Paciente", 50, y); doc.text("Cor", 90, y);
      doc.text("Valor", 110, y); doc.text("Status", 140, y); doc.text("Data", 170, y);
      y += 5;
      doc.setFont("helvetica", "normal");

      for (const r of workRecords) {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text((r.work_type || "").substring(0, 20), 14, y);
        doc.text((r.patient_name || "-").substring(0, 20), 50, y);
        doc.text(r.color || "-", 90, y);
        doc.text(r.value ? r.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-", 110, y);
        doc.text(r.status === "finished" ? "Finalizado" : "Em Andamento", 140, y);
        doc.text(format(new Date(r.start_date), "dd/MM/yy"), 170, y);
        y += 4;
      }

      doc.save(`producao-${employeeName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado!");
    } catch { toast.error("Erro ao exportar PDF"); } finally { setExporting(false); }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Produção");
      ws.columns = [
        { header: "Tipo", key: "type", width: 22 },
        { header: "Paciente", key: "patient", width: 22 },
        { header: "Cor", key: "color", width: 10 },
        { header: "Valor", key: "value", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Data", key: "date", width: 12 },
      ];
      for (const r of workRecords) {
        ws.addRow({
          type: r.work_type,
          patient: r.patient_name || "-",
          color: r.color || "-",
          value: r.value || 0,
          status: r.status === "finished" ? "Finalizado" : "Em Andamento",
          date: format(new Date(r.start_date), "dd/MM/yyyy"),
        });
      }
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `producao-${employeeName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      toast.success("Excel exportado!");
    } catch { toast.error("Erro ao exportar Excel"); } finally { setExporting(false); }
  };

  const exportToWord = () => {
    const html = buildHtmlTable();
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `producao-${employeeName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.doc`;
    a.click();
    toast.success("Word exportado!");
  };

  const exportToImage = async (type: "jpg" | "png") => {
    try {
      setExporting(true);
      const container = document.createElement("div");
      container.innerHTML = buildHtmlTable();
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "800px";
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
      document.body.removeChild(container);

      const link = document.createElement("a");
      link.download = `producao-${employeeName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.${type}`;
      link.href = canvas.toDataURL(type === "jpg" ? "image/jpeg" : "image/png", 0.95);
      link.click();
      toast.success(`${type.toUpperCase()} exportado!`);
    } catch { toast.error("Erro ao exportar imagem"); } finally { setExporting(false); }
  };

  if (workRecords.length === 0) return null;

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
        <DropdownMenuItem onClick={() => exportToImage("jpg")}>
          <Image className="h-4 w-4 mr-2" /> JPG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToImage("png")}>
          <Image className="h-4 w-4 mr-2" /> PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
