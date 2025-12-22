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
import { FileDown, FileSpreadsheet, Eye, X, Printer } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClientReportsProps {
  services: Service[];
  companyInfo: CompanyInfo | null;
}

export const ClientReports = ({ services, companyInfo }: ClientReportsProps) => {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePreviewPDF = async () => {
    if (!companyInfo) {
      toast.error("Informações da empresa não encontradas. Configure em 'Informações da Empresa'");
      return;
    }

    if (clientServices.length === 0) {
      toast.error("Nenhum serviço encontrado para este cliente");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: {
          services: clientServices,
          companyInfo,
          totalValue: totalClient,
          observations: `Relatório completo de serviços para o cliente: ${selectedClient}`
        }
      });

      if (error) {
        console.error('Erro do edge function:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Resposta inválida do servidor');
      }

      // Check for limit error (403)
      if (data.error) {
        toast.error(data.message || data.error);
        return;
      }

      if (!data.html) {
        throw new Error('HTML não retornado pelo servidor');
      }

      // Add signature to the HTML if available
      let finalHtml = data.html;
      if (signature) {
        finalHtml = data.html.replace(
          '</body>',
          `<div style="margin-top: 50px; text-align: center;">
            <img src="${signature}" style="max-width: 300px; border: 1px solid #ddd; padding: 10px;" />
            <p style="margin-top: 10px; color: #666; font-size: 12px;">Assinatura Digital</p>
          </div></body>`
        );
      }

      setPreviewHtml(finalHtml);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao gerar PDF';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.print();
    }
    setShowPreview(false);
    toast.success('PDF enviado para impressão!');
  };

  const handleSaveSignature = (sig: string) => {
    setSignature(sig);
    toast.success("Assinatura salva com sucesso!");
  };

  const handleClearSignature = () => {
    setSignature("");
  };

  const handleExportExcel = () => {
    if (clientServices.length === 0) {
      toast.error("Nenhum serviço encontrado para este cliente");
      return;
    }

    try {
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
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    }
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
              <Button onClick={handlePreviewPDF} variant="outline" disabled={isLoading}>
                <Eye className="h-4 w-4 mr-2" />
                {isLoading ? 'Gerando...' : 'Pré-visualizar PDF'}
              </Button>
              <Button onClick={handleExportExcel} variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          )}
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Pré-visualização do PDF</span>
                <div className="flex gap-2">
                  <Button onClick={handlePrintPDF} size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir / Salvar PDF
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-lg bg-white">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[70vh] border-0"
                title="Pré-visualização do PDF"
              />
            </div>
          </DialogContent>
        </Dialog>

        {selectedClient && clientServices.length > 0 && (
          <div className="space-y-4">
            <SignaturePad onSave={handleSaveSignature} onClear={handleClearSignature} />
            
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total do Cliente</p>
              <p className="text-2xl font-bold">{formatCurrency(totalClient)}</p>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {clientServices.map((service) => (
                <Card key={service.id} className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">{service.service_name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(Number(service.service_value))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Data:</span>
                        <span>{new Date(service.service_date).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            service.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {service.status === "paid" ? "Pago" : "Pendente"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <ScrollArea className="hidden md:block w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>{service.service_name}</TableCell>
                      <TableCell>{formatCurrency(Number(service.service_value))}</TableCell>
                      <TableCell>
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
