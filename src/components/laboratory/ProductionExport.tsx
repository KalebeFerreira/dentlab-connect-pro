 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Label } from "@/components/ui/label";
 import { Download, FileText, FileSpreadsheet, Send } from "lucide-react";
 import { toast } from "sonner";
 import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import jsPDF from "jspdf";
 import ExcelJS from "exceljs";
 import type { Employee } from "./EmployeeManagement";
 import type { WorkRecord } from "./WorkRecordManagement";
 
 interface ProductionExportProps {
   employees: Employee[];
   workRecords: WorkRecord[];
   periodFilter: string;
   labName?: string;
 }
 
 interface EmployeeReport {
   employee: Employee;
   records: WorkRecord[];
   totalValue: number;
   finishedCount: number;
   inProgressCount: number;
 }
 
 const WORK_TYPES: Record<string, string> = {
   coroa: "Coroa",
   protese_total: "Prótese Total",
   protese_parcial: "Prótese Parcial Removível",
   protese_fixa: "Prótese Fixa",
   faceta: "Faceta",
   onlay: "Onlay",
   inlay: "Inlay",
   placa_oclusao: "Placa de Oclusão",
   provisorio: "Provisório",
   modelo: "Modelo",
   nucleo: "Núcleo",
   implante: "Trabalho sobre Implante",
   outros: "Outros",
 };
 
 export const ProductionExport = ({ employees, workRecords, periodFilter, labName = "Laboratório" }: ProductionExportProps) => {
   const [sendDialogOpen, setSendDialogOpen] = useState(false);
   const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
   const [sending, setSending] = useState(false);
 
   const getFilteredData = (): EmployeeReport[] => {
     const now = new Date();
     let startDate: Date;
     let endDate: Date;
 
     if (periodFilter === "month") {
       startDate = startOfMonth(now);
       endDate = endOfMonth(now);
     } else {
       startDate = startOfYear(now);
       endDate = endOfYear(now);
     }
 
     return employees.filter(e => e.status === "active").map(employee => {
       const empRecords = workRecords.filter(record => {
         const recordDate = new Date(record.start_date);
         return record.employee_id === employee.id && 
                isWithinInterval(recordDate, { start: startDate, end: endDate });
       });
 
       return {
         employee,
         records: empRecords,
         totalValue: empRecords.reduce((sum, r) => sum + (r.value || 0), 0),
         finishedCount: empRecords.filter(r => r.status === "finished").length,
         inProgressCount: empRecords.filter(r => r.status === "in_progress").length,
       };
     }).filter(r => r.records.length > 0);
   };
 
   const getPeriodLabel = () => {
     const now = new Date();
     return periodFilter === "month" 
       ? format(now, "MMMM 'de' yyyy", { locale: ptBR })
       : format(now, "yyyy", { locale: ptBR });
   };
 
   const exportToPDF = async () => {
     try {
       const data = getFilteredData();
       if (data.length === 0) {
         toast.error("Nenhum dado para exportar");
         return;
       }
 
       const doc = new jsPDF();
       const pageWidth = doc.internal.pageSize.getWidth();
       let y = 20;
 
       // Header
       doc.setFontSize(18);
       doc.setFont("helvetica", "bold");
       doc.text("Relatório de Produção", pageWidth / 2, y, { align: "center" });
       y += 8;
 
       doc.setFontSize(12);
       doc.setFont("helvetica", "normal");
       doc.text(labName, pageWidth / 2, y, { align: "center" });
       y += 6;
       doc.text(`Período: ${getPeriodLabel()}`, pageWidth / 2, y, { align: "center" });
       y += 15;
 
       // Summary
       const totalRecords = data.reduce((sum, d) => sum + d.records.length, 0);
       const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);
       const totalFinished = data.reduce((sum, d) => sum + d.finishedCount, 0);
 
       doc.setFontSize(11);
       doc.setFont("helvetica", "bold");
       doc.text("Resumo Geral", 14, y);
       y += 6;
       doc.setFont("helvetica", "normal");
       doc.text(`Total de Trabalhos: ${totalRecords}`, 14, y);
       doc.text(`Finalizados: ${totalFinished}`, 80, y);
       doc.text(`Valor Total: ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 130, y);
       y += 12;
 
       // Per employee
       for (const report of data) {
         if (y > 250) {
           doc.addPage();
           y = 20;
         }
 
         doc.setFillColor(240, 240, 240);
         doc.rect(14, y - 4, pageWidth - 28, 8, "F");
         doc.setFont("helvetica", "bold");
         doc.text(report.employee.name, 16, y);
         if (report.employee.phone) doc.text(`WhatsApp: ${report.employee.phone}`, 100, y);
         y += 5;
         if (report.employee.email) {
           doc.setFont("helvetica", "normal");
           doc.text(`Email: ${report.employee.email}`, 16, y);
           y += 5;
         }
         y += 3;
 
         doc.setFont("helvetica", "normal");
         doc.setFontSize(9);
         
         // Table header
         doc.text("Tipo", 16, y);
         doc.text("Código", 60, y);
         doc.text("Início", 90, y);
         doc.text("Prazo", 115, y);
         doc.text("Status", 140, y);
         doc.text("Valor", 170, y);
         y += 5;
 
         for (const record of report.records) {
           if (y > 280) {
             doc.addPage();
             y = 20;
           }
           doc.text(WORK_TYPES[record.work_type] || record.work_type, 16, y);
           doc.text(record.work_code || "-", 60, y);
           doc.text(format(new Date(record.start_date), "dd/MM/yy"), 90, y);
           doc.text(record.deadline ? format(new Date(record.deadline), "dd/MM/yy") : "-", 115, y);
           doc.text(record.status === "finished" ? "Finalizado" : "Em Andamento", 140, y);
           doc.text(record.value ? record.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "-", 170, y);
           y += 4;
         }
 
         // Subtotal
         y += 2;
         doc.setFont("helvetica", "bold");
         doc.text(`Subtotal: ${report.records.length} trabalhos | ${report.finishedCount} finalizados | ${report.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 16, y);
         doc.setFontSize(11);
         y += 12;
       }
 
       doc.save(`relatorio-producao-${format(new Date(), "yyyy-MM-dd")}.pdf`);
       toast.success("PDF exportado com sucesso!");
     } catch (error) {
       toast.error("Erro ao exportar PDF");
       console.error(error);
     }
   };
 
   const exportToExcel = async () => {
     try {
       const data = getFilteredData();
       if (data.length === 0) {
         toast.error("Nenhum dado para exportar");
         return;
       }
 
       const workbook = new ExcelJS.Workbook();
       workbook.creator = labName;
       workbook.created = new Date();
 
       // Summary sheet
       const summarySheet = workbook.addWorksheet("Resumo");
       summarySheet.columns = [
         { header: "Funcionário", key: "name", width: 25 },
         { header: "WhatsApp", key: "phone", width: 18 },
         { header: "Email", key: "email", width: 30 },
         { header: "Total Trabalhos", key: "total", width: 15 },
         { header: "Finalizados", key: "finished", width: 12 },
         { header: "Em Andamento", key: "inProgress", width: 14 },
         { header: "Valor Total", key: "value", width: 15 },
       ];
 
       for (const report of data) {
         summarySheet.addRow({
           name: report.employee.name,
           phone: report.employee.phone || "-",
           email: report.employee.email || "-",
           total: report.records.length,
           finished: report.finishedCount,
           inProgress: report.inProgressCount,
           value: report.totalValue,
         });
       }
 
       // Style header
       summarySheet.getRow(1).font = { bold: true };
       summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
 
       // Details sheet
       const detailsSheet = workbook.addWorksheet("Detalhes");
       detailsSheet.columns = [
         { header: "Funcionário", key: "employee", width: 20 },
         { header: "Tipo de Trabalho", key: "workType", width: 25 },
         { header: "Código", key: "code", width: 12 },
         { header: "Data Início", key: "startDate", width: 12 },
         { header: "Prazo", key: "deadline", width: 12 },
         { header: "Data Fim", key: "endDate", width: 12 },
         { header: "Status", key: "status", width: 14 },
         { header: "Valor", key: "value", width: 14 },
         { header: "Observações", key: "notes", width: 30 },
       ];
 
       for (const report of data) {
         for (const record of report.records) {
           detailsSheet.addRow({
             employee: report.employee.name,
             workType: WORK_TYPES[record.work_type] || record.work_type,
             code: record.work_code || "-",
             startDate: format(new Date(record.start_date), "dd/MM/yyyy"),
             deadline: record.deadline ? format(new Date(record.deadline), "dd/MM/yyyy") : "-",
             endDate: record.end_date ? format(new Date(record.end_date), "dd/MM/yyyy") : "-",
             status: record.status === "finished" ? "Finalizado" : "Em Andamento",
             value: record.value || 0,
             notes: record.notes || "-",
           });
         }
       }
 
       detailsSheet.getRow(1).font = { bold: true };
       detailsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
 
       const buffer = await workbook.xlsx.writeBuffer();
       const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `relatorio-producao-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
       a.click();
       URL.revokeObjectURL(url);
 
       toast.success("Excel exportado com sucesso!");
     } catch (error) {
       toast.error("Erro ao exportar Excel");
       console.error(error);
     }
   };
 
   const exportToWord = async () => {
     try {
       const data = getFilteredData();
       if (data.length === 0) {
         toast.error("Nenhum dado para exportar");
         return;
       }
 
       let html = `
         <html>
         <head>
           <meta charset="utf-8">
           <style>
             body { font-family: Arial, sans-serif; padding: 20px; }
             h1 { text-align: center; color: #333; }
             h2 { color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
             .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
             table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
             th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
             th { background: #f0f0f0; }
             .subtotal { font-weight: bold; background: #fafafa; }
             .contact { font-size: 11px; color: #666; }
           </style>
         </head>
         <body>
           <h1>Relatório de Produção</h1>
           <p style="text-align:center">${labName} - Período: ${getPeriodLabel()}</p>
           
           <div class="summary">
             <strong>Resumo Geral:</strong> 
             ${data.reduce((sum, d) => sum + d.records.length, 0)} trabalhos | 
             ${data.reduce((sum, d) => sum + d.finishedCount, 0)} finalizados | 
             Valor Total: ${data.reduce((sum, d) => sum + d.totalValue, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
           </div>
       `;
 
       for (const report of data) {
         html += `
           <h2>${report.employee.name}</h2>
           <p class="contact">
             ${report.employee.phone ? `WhatsApp: ${report.employee.phone}` : ''}
             ${report.employee.phone && report.employee.email ? ' | ' : ''}
             ${report.employee.email ? `Email: ${report.employee.email}` : ''}
           </p>
           <table>
             <tr>
               <th>Tipo</th>
               <th>Código</th>
               <th>Início</th>
               <th>Prazo</th>
               <th>Status</th>
               <th>Valor</th>
             </tr>
         `;
 
         for (const record of report.records) {
           html += `
             <tr>
               <td>${WORK_TYPES[record.work_type] || record.work_type}</td>
               <td>${record.work_code || '-'}</td>
               <td>${format(new Date(record.start_date), "dd/MM/yyyy")}</td>
               <td>${record.deadline ? format(new Date(record.deadline), "dd/MM/yyyy") : '-'}</td>
               <td>${record.status === "finished" ? "Finalizado" : "Em Andamento"}</td>
               <td>${record.value ? record.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
             </tr>
           `;
         }
 
         html += `
             <tr class="subtotal">
               <td colspan="5">Subtotal: ${report.records.length} trabalhos (${report.finishedCount} finalizados)</td>
               <td>${report.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
             </tr>
           </table>
         `;
       }
 
       html += `</body></html>`;
 
       const blob = new Blob([html], { type: "application/msword" });
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `relatorio-producao-${format(new Date(), "yyyy-MM-dd")}.doc`;
       a.click();
       URL.revokeObjectURL(url);
 
       toast.success("Word exportado com sucesso!");
     } catch (error) {
       toast.error("Erro ao exportar Word");
       console.error(error);
     }
   };
 
   const handleSendReports = () => {
     const employeesWithContact = employees.filter(
       e => e.status === "active" && (e.phone || e.email)
     );
     setSelectedEmployees(employeesWithContact.map(e => e.id));
     setSendDialogOpen(true);
   };
 
   const sendReportsToEmployees = async () => {
     try {
       setSending(true);
       const data = getFilteredData();
       
       const selectedReports = data.filter(r => selectedEmployees.includes(r.employee.id));
       
       if (selectedReports.length === 0) {
         toast.error("Nenhum funcionário selecionado com dados");
         return;
       }
 
       for (const report of selectedReports) {
         if (report.employee.phone) {
           const message = `📊 *Relatório de Produção - ${getPeriodLabel()}*\n\n` +
             `Olá ${report.employee.name.split(" ")[0]}!\n\n` +
             `📈 Resumo:\n` +
             `• Total de trabalhos: ${report.records.length}\n` +
             `• Finalizados: ${report.finishedCount}\n` +
             `• Em andamento: ${report.inProgressCount}\n` +
             `• Valor total: ${report.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n` +
             `_${labName}_`;
           
           const phone = report.employee.phone.replace(/\D/g, "");
           const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
           window.open(whatsappUrl, "_blank");
         }
       }
 
       toast.success(`Relatórios enviados para ${selectedReports.length} funcionário(s)`);
       setSendDialogOpen(false);
     } catch (error) {
       toast.error("Erro ao enviar relatórios");
       console.error(error);
     } finally {
       setSending(false);
     }
   };
 
   const toggleEmployee = (id: string) => {
     setSelectedEmployees(prev =>
       prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
     );
   };
 
   const employeesWithContact = employees.filter(
     e => e.status === "active" && (e.phone || e.email)
   );
 
   return (
     <>
       <div className="flex gap-2">
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button variant="outline" size="sm">
               <Download className="h-4 w-4 mr-1" />
               Exportar
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end">
             <DropdownMenuItem onClick={exportToPDF}>
               <FileText className="h-4 w-4 mr-2" />
               PDF
             </DropdownMenuItem>
             <DropdownMenuItem onClick={exportToWord}>
               <FileText className="h-4 w-4 mr-2" />
               Word (.doc)
             </DropdownMenuItem>
             <DropdownMenuItem onClick={exportToExcel}>
               <FileSpreadsheet className="h-4 w-4 mr-2" />
               Excel
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
 
         {employeesWithContact.length > 0 && (
           <Button variant="outline" size="sm" onClick={handleSendReports}>
             <Send className="h-4 w-4 mr-1" />
             Enviar
           </Button>
         )}
       </div>
 
       <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Enviar Relatórios por WhatsApp</DialogTitle>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <p className="text-sm text-muted-foreground">
               Selecione os funcionários que receberão o relatório de produção:
             </p>
             <div className="max-h-[300px] overflow-y-auto space-y-2">
               {employeesWithContact.map(emp => (
                 <div key={emp.id} className="flex items-center space-x-2 p-2 rounded border">
                   <Checkbox
                     id={emp.id}
                     checked={selectedEmployees.includes(emp.id)}
                     onCheckedChange={() => toggleEmployee(emp.id)}
                   />
                   <Label htmlFor={emp.id} className="flex-1 cursor-pointer">
                     <span className="font-medium">{emp.name}</span>
                     <span className="text-xs text-muted-foreground block">
                       {emp.phone && `📱 ${emp.phone}`}
                       {emp.phone && emp.email && " | "}
                       {emp.email && `📧 ${emp.email}`}
                     </span>
                   </Label>
                 </div>
               ))}
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
               Cancelar
             </Button>
             <Button onClick={sendReportsToEmployees} disabled={sending || selectedEmployees.length === 0}>
               {sending ? "Enviando..." : `Enviar (${selectedEmployees.length})`}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 };