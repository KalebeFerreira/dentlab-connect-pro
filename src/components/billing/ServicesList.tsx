import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, FileText, Receipt, Send, FileSpreadsheet, Download } from "lucide-react";
import { Service, CompanyInfo } from "@/pages/Billing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import ExcelJS from 'exceljs';

interface ServicesListProps {
  services: Service[];
  onDelete: (id: string) => Promise<void>;
  companyInfo: CompanyInfo | null;
}

export const ServicesList = ({ services, onDelete, companyInfo }: ServicesListProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleGenerateReceipt = async (service: Service) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: {
          services: [service],
          companyInfo,
          totalValue: Number(service.service_value)
        }
      });

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      alert('Erro ao gerar recibo. Tente novamente.');
    }
  };

  const handleGenerateInvoice = async (service: Service) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: {
          services: [service],
          companyInfo,
          totalValue: Number(service.service_value),
          observations: ''
        }
      });

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Erro ao gerar nota fiscal:', error);
      alert('Erro ao gerar nota fiscal. Tente novamente.');
    }
  };

  const handleSendWhatsApp = (service: Service) => {
    if (!companyInfo?.phone) {
      alert("Configure o telefone da empresa primeiro!");
      return;
    }

    const phone = companyInfo.phone.replace(/\D/g, "");
    const message = `Olá! Segue o documento referente ao serviço: ${service.service_name} - ${formatCurrency(Number(service.service_value))}`;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleExportAllPDF = async () => {
    try {
      const totalValue = services.reduce((sum, s) => sum + Number(s.service_value), 0);
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: {
          services,
          companyInfo,
          totalValue
        }
      });

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleExportAllExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Todos os Serviços');
    
    // Header info
    worksheet.addRow(['Relatório Completo de Serviços']);
    if (companyInfo) {
      worksheet.addRow([`Empresa: ${companyInfo.company_name}`]);
    }
    worksheet.addRow([`Total de Serviços: ${services.length}`]);
    worksheet.addRow([`Valor Total: ${formatCurrency(services.reduce((sum, s) => sum + Number(s.service_value), 0))}`]);
    worksheet.addRow([]);
    
    // Column headers
    worksheet.addRow(['Serviço', 'Cliente', 'Paciente', 'Valor', 'Data']);
    
    // Data rows
    services.forEach(service => {
      worksheet.addRow([
        service.service_name,
        service.client_name || '-',
        service.patient_name || '-',
        Number(service.service_value),
        format(new Date(service.service_date), 'dd/MM/yyyy', { locale: ptBR })
      ]);
    });
    
    worksheet.addRow([]);
    worksheet.addRow(['TOTAL', '', '', services.reduce((sum, s) => sum + Number(s.service_value), 0), '']);
    
    // Set column widths
    worksheet.columns = [
      { width: 30 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Nenhum serviço cadastrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Serviços Cadastrados</CardTitle>
          {services.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={handleExportAllPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleExportAllExcel} variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium">{service.service_name}</TableCell>
                <TableCell>{service.client_name || "-"}</TableCell>
                <TableCell>{service.patient_name || "-"}</TableCell>
                <TableCell>{formatCurrency(Number(service.service_value))}</TableCell>
                <TableCell>
                  {format(new Date(service.service_date), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGenerateReceipt(service)}
                      title="Gerar Recibo"
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGenerateInvoice(service)}
                      title="Gerar Nota Fiscal"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSendWhatsApp(service)}
                      title="Enviar por WhatsApp"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(service.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
