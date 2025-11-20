import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Service, CompanyInfo } from "@/pages/Billing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { SignaturePad } from "./SignaturePad";
import { toast } from "sonner";

interface ClientReportsProps {
  services: Service[];
  companyInfo: CompanyInfo | null;
}

export const ClientReports = ({ services, companyInfo }: ClientReportsProps) => {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [signature, setSignature] = useState<string>("");

  const getAvailableClients = () => {
    const clients = new Set<string>();
    services.forEach((service) => {
      if (service.client_name) {
        clients.add(service.client_name);
      }
    });
    return Array.from(clients).sort();
  };

  const getClientServices = () => {
    if (!selectedClient) return [];

    return services.filter((service) => service.client_name === selectedClient);
  };

  const clientServices = getClientServices();
  const totalClient = clientServices.reduce(
    (sum, service) => sum + Number(service.service_value),
    0
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleExportPDF = async () => {
    if (!signature) {
      toast.error("Por favor, adicione sua assinatura digital primeiro");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: {
          services: clientServices,
          companyInfo,
          totalValue: totalClient
        }
      });

      if (error) throw error;

      // Add signature to the HTML
      const htmlWithSignature = data.html.replace(
        '</body>',
        `<div style="margin-top: 50px; text-align: center;">
          <img src="${signature}" style="max-width: 300px; border: 1px solid #ddd; padding: 10px;" />
          <p style="margin-top: 10px; color: #666; font-size: 12px;">Assinatura Digital</p>
        </div></body>`
      );

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlWithSignature);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleSaveSignature = (sig: string) => {
    setSignature(sig);
    toast.success("Assinatura salva com sucesso!");
  };

  const handleClearSignature = () => {
    setSignature("");
  };

  const handleExportExcel = () => {
    const worksheetData = [
      ['Relatório de Cliente'],
      [`Cliente: ${selectedClient}`],
      [`Total: ${formatCurrency(totalClient)}`],
      [],
      ['Serviço', 'Valor', 'Data'],
      ...clientServices.map(service => [
        service.service_name,
        Number(service.service_value),
        new Date(service.service_date).toLocaleDateString('pt-BR')
      ]),
      [],
      ['TOTAL', totalClient, '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Define largura das colunas
    worksheet['!cols'] = [
      { wch: 30 }, // Serviço
      { wch: 15 }, // Valor
      { wch: 12 }  // Data
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Cliente');
    
    XLSX.writeFile(workbook, `relatorio_cliente_${selectedClient.replace(/\s+/g, '_')}.xlsx`);
  };

  const availableClients = getAvailableClients();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios de Clientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {availableClients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClient && (
            <div className="flex gap-2">
              <Button onClick={handleExportPDF} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleExportExcel} variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          )}
        </div>

        {selectedClient && clientServices.length > 0 && (
          <div className="space-y-4">
            <SignaturePad onSave={handleSaveSignature} onClear={handleClearSignature} />
            
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total do Cliente</p>
              <p className="text-2xl font-bold">{formatCurrency(totalClient)}</p>
            </div>

            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Serviço</TableHead>
                    <TableHead className="text-xs md:text-sm">Valor</TableHead>
                    <TableHead className="text-xs md:text-sm">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{service.service_name}</TableCell>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{formatCurrency(Number(service.service_value))}</TableCell>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">
                        {new Date(service.service_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {selectedClient && clientServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para este cliente.
          </p>
        )}

        {availableClients.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum cliente com serviços cadastrados.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
