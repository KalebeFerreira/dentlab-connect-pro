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

interface MonthlyReportsProps {
  services: Service[];
  companyInfo: CompanyInfo | null;
}

export const MonthlyReports = ({ services, companyInfo }: MonthlyReportsProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [consolidatedMode, setConsolidatedMode] = useState(false);

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

  const getConsolidatedServices = () => {
    if (selectedMonths.length === 0) return [];
    return services.filter((service) => {
      const date = new Date(service.service_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      return selectedMonths.includes(monthYear);
    });
  };

  const consolidatedServices = getConsolidatedServices();
  const totalConsolidated = consolidatedServices.reduce(
    (sum, service) => sum + Number(service.service_value),
    0
  );

  const toggleMonthSelection = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleExportPDF = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report-pdf', {
        body: {
          services: monthlyServices,
          companyInfo,
          totalValue: totalMonth,
          month: selectedMonth
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
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
    }
  };

  const handleExportConsolidatedPDF = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report-pdf', {
        body: {
          services: consolidatedServices,
          companyInfo,
          totalValue: totalConsolidated,
          month: `${selectedMonths.length} meses selecionados`,
          isConsolidated: true,
          months: selectedMonths.sort()
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
      console.error('Erro ao gerar relatório consolidado:', error);
      alert('Erro ao gerar relatório consolidado. Tente novamente.');
    }
  };

  const handleExportExcel = () => {
    const worksheetData = [
      ['Relatório Mensal de Serviços'],
      [`Mês: ${selectedMonth}`],
      [`Total: ${formatCurrency(totalMonth)}`],
      [],
      ['Serviço', 'Cliente', 'Valor', 'Data'],
      ...monthlyServices.map(service => [
        service.service_name,
        service.client_name || '-',
        Number(service.service_value),
        new Date(service.service_date).toLocaleDateString('pt-BR')
      ]),
      [],
      ['TOTAL', '', totalMonth, '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Define largura das colunas
    worksheet['!cols'] = [
      { wch: 30 }, // Serviço
      { wch: 20 }, // Cliente
      { wch: 15 }, // Valor
      { wch: 12 }  // Data
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Mensal');
    
    XLSX.writeFile(workbook, `relatorio_mensal_${selectedMonth}.xlsx`);
  };

  const availableMonths = getAvailableMonths();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios Mensais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant={!consolidatedMode ? "default" : "outline"}
            onClick={() => setConsolidatedMode(false)}
            size="sm"
          >
            Mensal
          </Button>
          <Button
            variant={consolidatedMode ? "default" : "outline"}
            onClick={() => setConsolidatedMode(true)}
            size="sm"
          >
            Consolidado
          </Button>
        </div>

        {!consolidatedMode ? (
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
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availableMonths.map((month) => (
                <Button
                  key={month}
                  variant={selectedMonths.includes(month) ? "default" : "outline"}
                  onClick={() => toggleMonthSelection(month)}
                  size="sm"
                  className="w-full"
                >
                  {month}
                </Button>
              ))}
            </div>
            {selectedMonths.length > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleExportConsolidatedPDF} variant="outline">
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF Consolidado ({selectedMonths.length} meses)
                </Button>
              </div>
            )}
          </div>
        )}

        {!consolidatedMode && selectedMonth && monthlyServices.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total do Mês</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonth)}</p>
            </div>

            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Serviço</TableHead>
                    <TableHead className="text-xs md:text-sm">Cliente</TableHead>
                    <TableHead className="text-xs md:text-sm">Valor</TableHead>
                    <TableHead className="text-xs md:text-sm">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{service.service_name}</TableCell>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{service.client_name || "-"}</TableCell>
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

        {consolidatedMode && selectedMonths.length > 0 && consolidatedServices.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Consolidado ({selectedMonths.length} meses)</p>
              <p className="text-2xl font-bold">{formatCurrency(totalConsolidated)}</p>
              <p className="text-xs text-muted-foreground mt-2">{consolidatedServices.length} serviços</p>
            </div>

            <ScrollArea className="w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm">Serviço</TableHead>
                    <TableHead className="text-xs md:text-sm">Cliente</TableHead>
                    <TableHead className="text-xs md:text-sm">Valor</TableHead>
                    <TableHead className="text-xs md:text-sm">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{service.service_name}</TableCell>
                      <TableCell className="text-xs md:text-sm px-2 md:px-4">{service.client_name || "-"}</TableCell>
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

        {!consolidatedMode && selectedMonth && monthlyServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para este mês.
          </p>
        )}

        {consolidatedMode && selectedMonths.length > 0 && consolidatedServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para os meses selecionados.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
