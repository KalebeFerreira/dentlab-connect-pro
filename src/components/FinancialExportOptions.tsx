import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Loader2, FileText, FileSpreadsheet, Image } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import * as ExcelJS from "exceljs";
import { generatePDF, createElementFromHTML, cleanupElement } from "@/lib/pdfGenerator";
interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  status: string;
  month: number;
  year: number;
  created_at: string;
}

interface FinancialExportOptionsProps {
  transactions: Transaction[];
  month: number;
  year: number;
  income: number;
  expense: number;
  profit: number;
  pending: number;
  companyName?: string;
  disabled?: boolean;
}

type ExportFormat = "pdf" | "word" | "excel" | "jpg" | "png" | null;

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const FinancialExportOptions = ({
  transactions,
  month,
  year,
  income,
  expense,
  profit,
  pending,
  companyName = "Minha Empresa",
  disabled = false,
}: FinancialExportOptionsProps) => {
  const [exporting, setExporting] = useState<ExportFormat>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string) => {
    return type === "receipt" ? "Receita" : "Despesa";
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const createReportHTML = () => {
    const incomeTransactions = transactions.filter(t => t.transaction_type === "receipt");
    const expenseTransactions = transactions.filter(t => t.transaction_type === "payment");

    return `
      <div style="font-family: Arial, sans-serif; padding: 40px; background: white; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1c4587; padding-bottom: 20px;">
          <h1 style="font-size: 28px; color: #1c4587; margin-bottom: 8px;">${companyName}</h1>
          <h2 style="font-size: 20px; color: #374151; margin-bottom: 4px;">Relatório Financeiro</h2>
          <p style="font-size: 14px; color: #6b7280;">${monthNames[month - 1]} de ${year}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px;">
          <div style="padding: 20px; border-radius: 12px; text-align: center; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);">
            <p style="font-size: 12px; font-weight: 500; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Receitas</p>
            <p style="font-size: 24px; font-weight: 700; color: #16a34a;">${formatCurrency(income)}</p>
          </div>
          <div style="padding: 20px; border-radius: 12px; text-align: center; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);">
            <p style="font-size: 12px; font-weight: 500; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Despesas</p>
            <p style="font-size: 24px; font-weight: 700; color: #dc2626;">${formatCurrency(expense)}</p>
          </div>
          <div style="padding: 20px; border-radius: 12px; text-align: center; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);">
            <p style="font-size: 12px; font-weight: 500; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Lucro</p>
            <p style="font-size: 24px; font-weight: 700; color: ${profit >= 0 ? '#2563eb' : '#dc2626'};">${formatCurrency(profit)}</p>
          </div>
          <div style="padding: 20px; border-radius: 12px; text-align: center; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);">
            <p style="font-size: 12px; font-weight: 500; text-transform: uppercase; color: #6b7280; margin-bottom: 8px;">Pendentes</p>
            <p style="font-size: 24px; font-weight: 700; color: #d97706;">${formatCurrency(pending)}</p>
          </div>
        </div>

        ${incomeTransactions.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #16a34a;">Receitas</h3>
            <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Descrição</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Data</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Status</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${incomeTransactions.map(t => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px; color: #374151;">${t.description || "Sem descrição"}</td>
                    <td style="padding: 12px; color: #6b7280;">${formatDate(t.created_at)}</td>
                    <td style="padding: 12px; color: #6b7280;">${getStatusLabel(t.status)}</td>
                    <td style="padding: 12px; text-align: right; color: #16a34a; font-weight: 600;">${formatCurrency(t.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}

        ${expenseTransactions.length > 0 ? `
          <div style="margin-bottom: 32px;">
            <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Despesas</h3>
            <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Descrição</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Data</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Status</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${expenseTransactions.map(t => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px; color: #374151;">${t.description || "Sem descrição"}</td>
                    <td style="padding: 12px; color: #6b7280;">${formatDate(t.created_at)}</td>
                    <td style="padding: 12px; color: #6b7280;">${getStatusLabel(t.status)}</td>
                    <td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">${formatCurrency(t.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
        </div>
      </div>
    `;
  };

  const exportAsPDF = async () => {
    try {
      setExporting("pdf");
      
      const container = createElementFromHTML(createReportHTML());
      container.style.width = "800px";
      
      try {
        await generatePDF(container, {
          filename: `relatorio-financeiro-${monthNames[month - 1]}-${year}.pdf`,
          margin: 10,
          format: "a4",
          orientation: "portrait",
          scale: 2,
        });
        toast.success("PDF exportado com sucesso!");
      } finally {
        cleanupElement(container);
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(null);
    }
  };

  const exportAsWord = async () => {
    try {
      setExporting("word");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório Financeiro - ${monthNames[month - 1]} ${year}</title>
        </head>
        <body>
          ${createReportHTML()}
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: "application/msword" });
      downloadFile(blob, `relatorio-financeiro-${monthNames[month - 1]}-${year}.doc`);
      toast.success("Word exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting Word:", error);
      toast.error("Erro ao exportar Word");
    } finally {
      setExporting(null);
    }
  };

  const exportAsExcel = async () => {
    try {
      setExporting("excel");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Relatório Financeiro");

      // Title
      worksheet.mergeCells("A1:E1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `Relatório Financeiro - ${monthNames[month - 1]} ${year}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };

      // Summary
      worksheet.addRow([]);
      worksheet.addRow(["Resumo"]);
      worksheet.addRow(["Receitas", formatCurrency(income)]);
      worksheet.addRow(["Despesas", formatCurrency(expense)]);
      worksheet.addRow(["Lucro", formatCurrency(profit)]);
      worksheet.addRow(["Pendentes", formatCurrency(pending)]);
      worksheet.addRow([]);

      // Transactions header
      worksheet.addRow(["Transações"]);
      worksheet.addRow(["Tipo", "Descrição", "Data", "Status", "Valor"]);

      const headerRow = worksheet.lastRow;
      if (headerRow) {
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE5E7EB" },
          };
        });
      }

      // Transactions data
      transactions.forEach((t) => {
        worksheet.addRow([
          getTypeLabel(t.transaction_type),
          t.description || "Sem descrição",
          formatDate(t.created_at),
          getStatusLabel(t.status),
          t.amount,
        ]);
      });

      // Format columns
      worksheet.columns = [
        { width: 12 },
        { width: 40 },
        { width: 15 },
        { width: 12 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadFile(blob, `relatorio-financeiro-${monthNames[month - 1]}-${year}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(null);
    }
  };

  const exportAsImage = async (format: "jpg" | "png") => {
    try {
      setExporting(format);

      const container = document.createElement("div");
      container.innerHTML = createReportHTML();
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "800px";
      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(container);

      const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
      const extension = format === "jpg" ? "jpg" : "png";

      canvas.toBlob(
        (blob) => {
          if (blob) {
            downloadFile(blob, `relatorio-financeiro-${monthNames[month - 1]}-${year}.${extension}`);
            toast.success(`${format.toUpperCase()} exportado com sucesso!`);
          }
        },
        mimeType,
        0.95
      );
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      toast.error(`Erro ao exportar ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const isExporting = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          <span className="hidden sm:inline">Exportar</span>
          <span className="sm:hidden">Exp.</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={exportAsPDF} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsWord} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar Word
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsExcel} disabled={isExporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsImage("jpg")} disabled={isExporting}>
          <Image className="h-4 w-4 mr-2" />
          Exportar JPG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsImage("png")} disabled={isExporting}>
          <Image className="h-4 w-4 mr-2" />
          Exportar PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
