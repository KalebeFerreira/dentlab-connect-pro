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
import { supabase } from "@/integrations/supabase/client";

interface MonthlyReportsProps {
  services: Service[];
  companyInfo: CompanyInfo | null;
}

export const MonthlyReports = ({ services, companyInfo }: MonthlyReportsProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const getAvailableMonths = () => {
    const months = new Set<string>();
    services.forEach((service) => {
      const date = new Date(service.service_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      months.add(monthYear);
    });
    return Array.from(months).sort((a, b) => {
      const [monthA, yearA] = a.split("/");
      const [monthB, yearB] = b.split("/");
      return (
        new Date(parseInt(yearB), parseInt(monthB) - 1).getTime() -
        new Date(parseInt(yearA), parseInt(monthA) - 1).getTime()
      );
    });
  };

  const getMonthlyServices = () => {
    if (!selectedMonth) return [];

    return services.filter((service) => {
      const date = new Date(service.service_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      return monthYear === selectedMonth;
    });
  };

  const monthlyServices = getMonthlyServices();
  const totalMonth = monthlyServices.reduce(
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
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: {
          services: monthlyServices,
          companyInfo,
          totalValue: totalMonth
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

  const handleExportExcel = () => {
    // TODO: Implementar exportação Excel
    console.log("Exportar Excel mensal");
  };

  const availableMonths = getAvailableMonths();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios Mensais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedMonth && (
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

        {selectedMonth && monthlyServices.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total do Mês</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonth)}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{service.service_name}</TableCell>
                    <TableCell>{service.client_name || "-"}</TableCell>
                    <TableCell>{formatCurrency(Number(service.service_value))}</TableCell>
                    <TableCell>
                      {new Date(service.service_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {selectedMonth && monthlyServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para este mês.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
