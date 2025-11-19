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
import { Trash2, FileText, Receipt, Send } from "lucide-react";
import { Service, CompanyInfo } from "@/pages/Billing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const handleGenerateReceipt = (service: Service) => {
    // TODO: Implementar geração de recibo PDF
    console.log("Gerar recibo para:", service);
  };

  const handleGenerateInvoice = (service: Service) => {
    // TODO: Implementar geração de nota fiscal PDF
    console.log("Gerar nota fiscal para:", service);
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
        <CardTitle>Serviços Cadastrados</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Cliente</TableHead>
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
