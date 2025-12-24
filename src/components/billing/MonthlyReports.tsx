import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, FileSpreadsheet, MessageCircle, Mail, History, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { useFreemiumLimits } from "@/hooks/useFreemiumLimits";

interface MonthlyReportsProps {
  services: Service[];
  companyInfo: CompanyInfo | null;
  onServiceUpdate?: () => void;
}

interface ReportHistoryItem {
  id: string;
  client_name: string;
  month: string;
  channel: 'whatsapp' | 'email';
  recipient: string;
  total_value: number;
  services_count: number;
  sent_at: string;
}

export const MonthlyReports = ({ services, companyInfo, onServiceUpdate }: MonthlyReportsProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [consolidatedMode, setConsolidatedMode] = useState(false);
  const [clientReportMode, setClientReportMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedClientMonth, setSelectedClientMonth] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const { isSubscribed } = useFreemiumLimits();
  
  // Edit service state
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    service_name: '',
    service_value: 0,
    patient_name: '',
    color: ''
  });

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
    if (!companyInfo) {
      toast.error("Informações da empresa não encontradas. Configure em 'Informações da Empresa'");
      return;
    }

    if (monthlyServices.length === 0) {
      toast.error("Nenhum serviço encontrado para este mês");
      return;
    }

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

      if (!data || !data.html) {
        throw new Error('Resposta inválida do servidor');
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao gerar relatório';
      toast.error(errorMessage);
    }
  };

  const handleExportClientPDF = async () => {
    if (!companyInfo) {
      toast.error("Informações da empresa não encontradas. Configure em 'Informações da Empresa'");
      return;
    }

    if (clientMonthlyServices.length === 0) {
      toast.error("Nenhum serviço encontrado para este cliente no mês selecionado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report-pdf', {
        body: {
          services: clientMonthlyServices,
          companyInfo,
          totalValue: totalClientMonth,
          month: selectedClientMonth,
          clientName: selectedClient
        }
      });

      if (error) throw error;

      if (!data || !data.html) {
        throw new Error('Resposta inválida do servidor');
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('PDF do cliente gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar relatório do cliente:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao gerar relatório do cliente';
      toast.error(errorMessage);
    }
  };

  const handleExportConsolidatedPDF = async () => {
    if (!companyInfo) {
      toast.error("Informações da empresa não encontradas. Configure em 'Informações da Empresa'");
      return;
    }

    if (selectedMonths.length === 0) {
      toast.error("Selecione pelo menos um mês para o relatório consolidado");
      return;
    }

    if (consolidatedServices.length === 0) {
      toast.error("Nenhum serviço encontrado para os meses selecionados");
      return;
    }

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

      if (!data || !data.html) {
        throw new Error('Resposta inválida do servidor');
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('PDF consolidado gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar relatório consolidado:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao gerar relatório consolidado';
      toast.error(errorMessage);
    }
  };

  const handleExportExcel = () => {
    if (monthlyServices.length === 0) {
      toast.error("Nenhum serviço encontrado para este mês");
      return;
    }

    try {
      // Agrupar serviços por clínica
      const servicesByClinic = monthlyServices.reduce((acc, service) => {
        const clinicName = service.client_name || "Sem Clínica";
        if (!acc[clinicName]) {
          acc[clinicName] = [];
        }
        acc[clinicName].push(service);
        return acc;
      }, {} as Record<string, typeof monthlyServices>);

      const worksheetData: any[] = [
        ['Relatório Mensal de Serviços'],
        [`Mês: ${selectedMonth}`],
        [`Total Geral: ${formatCurrency(totalMonth)}`],
        []
      ];

      // Adicionar cada clínica
      Object.keys(servicesByClinic).sort().forEach((clinicName) => {
        const clinicServices = servicesByClinic[clinicName];
        const clinicTotal = clinicServices.reduce(
          (sum, service) => sum + Number(service.service_value),
          0
        );

        worksheetData.push(
          [`CLÍNICA: ${clinicName}`, '', '', `Subtotal: ${formatCurrency(clinicTotal)}`],
          ['Serviço', 'Paciente', 'Valor', 'Data'],
          ...clinicServices.map(service => [
            service.service_name,
            service.patient_name || '-',
            Number(service.service_value),
            new Date(service.service_date).toLocaleDateString('pt-BR')
          ]),
          []
        );
      });

      worksheetData.push(['TOTAL GERAL', '', totalMonth, '']);

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Define largura das colunas
      worksheet['!cols'] = [
        { wch: 30 }, // Serviço
        { wch: 20 }, // Paciente
        { wch: 15 }, // Valor
        { wch: 12 }  // Data
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Mensal');
      
      XLSX.writeFile(workbook, `relatorio_mensal_${selectedMonth.replace(/\//g, '-')}.xlsx`);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  const getAvailableClients = () => {
    const clients = new Set<string>();
    services.forEach((service) => {
      if (service.client_name) {
        clients.add(service.client_name);
      }
    });
    const allClients = Array.from(clients).sort();
    
    // Limitar a 2 clientes no plano gratuito
    if (!isSubscribed) {
      return allClients.slice(0, 2);
    }
    return allClients;
  };

  const getClientMonthlyServices = () => {
    if (!selectedClient || !selectedClientMonth) return [];
    
    return services.filter((service) => {
      const date = new Date(service.service_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      return service.client_name === selectedClient && monthYear === selectedClientMonth;
    });
  };

  const clientMonthlyServices = getClientMonthlyServices();
  const totalClientMonth = clientMonthlyServices.reduce(
    (sum, service) => sum + Number(service.service_value),
    0
  );

  const saveReportHistory = async (channel: 'whatsapp' | 'email', recipient: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('report_history').insert({
        user_id: user.id,
        client_name: selectedClient,
        month: selectedClientMonth,
        channel,
        recipient,
        total_value: totalClientMonth,
        services_count: clientMonthlyServices.length
      });
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  const loadReportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('report_history')
        .select('*')
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setReportHistory((data || []) as ReportHistoryItem[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
    }
  };

  useEffect(() => {
    if (showHistory) {
      loadReportHistory();
    }
  }, [showHistory]);

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setEditForm({
      service_name: service.service_name,
      service_value: service.service_value,
      patient_name: service.patient_name || '',
      color: service.color || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;
    
    try {
      const { error } = await supabase
        .from('services')
        .update({
          service_name: editForm.service_name,
          service_value: editForm.service_value,
          patient_name: editForm.patient_name || null,
          color: editForm.color || null
        })
        .eq('id', editingService.id);

      if (error) throw error;

      toast.success('Serviço atualizado!');
      setEditDialogOpen(false);
      setEditingService(null);
      onServiceUpdate?.();
    } catch (error: any) {
      console.error('Erro ao atualizar serviço:', error);
      toast.error('Erro ao atualizar: ' + error.message);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Deseja realmente excluir este serviço?')) return;
    
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'deleted' })
        .eq('id', serviceId);

      if (error) throw error;

      toast.success('Serviço excluído!');
      onServiceUpdate?.();
    } catch (error: any) {
      console.error('Erro ao excluir serviço:', error);
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!clientPhone) {
      toast.error("Por favor, insira o telefone do cliente");
      return;
    }

    const message = `Olá! Segue o relatório mensal de serviços:\n\n` +
      `*Cliente:* ${selectedClient}\n` +
      `*Período:* ${selectedClientMonth}\n` +
      `*Total de Serviços:* ${clientMonthlyServices.length}\n` +
      `*Valor Total:* ${formatCurrency(totalClientMonth)}\n\n` +
      `*Detalhamento:*\n` +
      clientMonthlyServices.map((service, idx) => 
        `${idx + 1}. ${service.service_name} - ${formatCurrency(Number(service.service_value))} - ${new Date(service.service_date).toLocaleDateString("pt-BR")}`
      ).join('\n');

    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = clientPhone.replace(/\D/g, '');
    
    await saveReportHistory('whatsapp', clientPhone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
    toast.success("Abrindo WhatsApp e salvando no histórico...");
  };

  const handleSendEmail = async () => {
    if (!clientEmail) {
      toast.error("Por favor, insira o email do cliente");
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-monthly-report-email', {
        body: {
          clientEmail,
          clientName: selectedClient,
          month: selectedClientMonth,
          services: clientMonthlyServices,
          companyInfo,
          totalValue: totalClientMonth
        }
      });

      if (error) throw error;

      // Verificar se o Resend retornou erro
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      await saveReportHistory('email', clientEmail);
      
      toast.success("Email enviado com sucesso!");
      setEmailDialogOpen(false);
      setClientEmail("");
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast.error('Erro ao enviar email. Verifique se seu domínio está verificado no Resend.');
    } finally {
      setSendingEmail(false);
    }
  };

  const availableMonths = getAvailableMonths();
  const availableClients = getAvailableClients();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Relatórios Mensais</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? "Ocultar Histórico" : "Ver Histórico"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showHistory ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Histórico de Envios</h3>
            {reportHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum envio registrado ainda.
              </p>
            ) : (
              <ScrollArea className="w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Serviços</TableHead>
                      <TableHead>Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(item.sent_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{item.client_name}</TableCell>
                        <TableCell>{item.month}</TableCell>
                        <TableCell>
                          <Badge variant={item.channel === 'whatsapp' ? 'default' : 'secondary'}>
                            {item.channel === 'whatsapp' ? (
                              <><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</>
                            ) : (
                              <><Mail className="h-3 w-3 mr-1" /> Email</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.recipient}</TableCell>
                        <TableCell>{item.services_count}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(Number(item.total_value))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                variant={!consolidatedMode && !clientReportMode ? "default" : "outline"}
                onClick={() => {
                  setConsolidatedMode(false);
                  setClientReportMode(false);
                }}
                size="sm"
              >
                Mensal
              </Button>
              <Button
                variant={consolidatedMode ? "default" : "outline"}
                onClick={() => {
                  setConsolidatedMode(true);
                  setClientReportMode(false);
                }}
                size="sm"
              >
                Consolidado
              </Button>
              <Button
                variant={clientReportMode ? "default" : "outline"}
                onClick={() => {
                  setConsolidatedMode(false);
                  setClientReportMode(true);
                }}
                size="sm"
              >
                Por Cliente
                {!isSubscribed && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Máx. 2
                  </Badge>
                )}
              </Button>
            </div>

        {!consolidatedMode && !clientReportMode && (
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
        )}

        {consolidatedMode && (
          <>
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
          </>
        )}

        {!consolidatedMode && !clientReportMode && selectedMonth && monthlyServices.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total do Mês</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonth)}</p>
            </div>

            {/* Agrupar serviços por clínica */}
            {(() => {
              const servicesByClinic = monthlyServices.reduce((acc, service) => {
                const clinicName = service.client_name || "Sem Clínica";
                if (!acc[clinicName]) {
                  acc[clinicName] = [];
                }
                acc[clinicName].push(service);
                return acc;
              }, {} as Record<string, typeof monthlyServices>);

              const clinicNames = Object.keys(servicesByClinic).sort();

              return clinicNames.map((clinicName) => {
                const clinicServices = servicesByClinic[clinicName];
                const clinicTotal = clinicServices.reduce(
                  (sum, service) => sum + Number(service.service_value),
                  0
                );

                return (
                  <div key={clinicName} className="space-y-3">
                    {/* Cabeçalho da Clínica */}
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">{clinicName}</h3>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Subtotal</p>
                          <p className="text-lg font-bold">{formatCurrency(clinicTotal)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {clinicServices.length} {clinicServices.length === 1 ? 'serviço' : 'serviços'}
                      </p>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2 pl-2">
                      {clinicServices.map((service) => (
                        <Card key={service.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-sm">{service.service_name}</h4>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleEditService(service)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
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
                            <div className="space-y-1 text-sm">
                              {service.patient_name && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Paciente:</span>
                                  <span className="font-medium">{service.patient_name}</span>
                                </div>
                              )}
                              {service.color && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Cor:</span>
                                  <span className="font-medium">{service.color}</span>
                                </div>
                              )}
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
                            <TableHead>Paciente</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="w-20">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clinicServices.map((service) => (
                            <TableRow key={service.id}>
                              <TableCell>{service.service_name}</TableCell>
                              <TableCell>{service.patient_name || "-"}</TableCell>
                              <TableCell>{service.color || "-"}</TableCell>
                              <TableCell>{formatCurrency(Number(service.service_value))}</TableCell>
                              <TableCell>
                                {new Date(service.service_date).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleEditService(service)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleDeleteService(service.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {consolidatedMode && selectedMonths.length > 0 && consolidatedServices.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Consolidado ({selectedMonths.length} meses)</p>
              <p className="text-2xl font-bold">{formatCurrency(totalConsolidated)}</p>
              <p className="text-xs text-muted-foreground mt-2">{consolidatedServices.length} serviços</p>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {consolidatedServices.map((service) => (
                <Card key={service.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-sm">{service.service_name}</h3>
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
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{service.client_name || "-"}</span>
                      </div>
                      {service.color && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cor:</span>
                          <span className="font-medium">{service.color}</span>
                        </div>
                      )}
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>{service.service_name}</TableCell>
                      <TableCell>{service.client_name || "-"}</TableCell>
                      <TableCell>{service.color || "-"}</TableCell>
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

        {clientReportMode && (
          <div className="space-y-4">
            {!isSubscribed && (
              <div className="p-4 bg-muted rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  <strong>Plano Gratuito:</strong> Você pode visualizar relatórios de até 2 clientes. 
                  Faça upgrade para acessar relatórios de todos os seus clientes.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
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
              </div>

              <div>
                <Label>Mês</Label>
                <Select value={selectedClientMonth} onValueChange={setSelectedClientMonth}>
                  <SelectTrigger>
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
              </div>
            </div>

            {selectedClient && selectedClientMonth && clientMonthlyServices.length > 0 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="text-lg font-semibold">{selectedClient}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Período</p>
                      <p className="text-lg font-semibold">{selectedClientMonth}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">Total do Período</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalClientMonth)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{clientMonthlyServices.length} serviços</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar por Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Relatório por Email</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="client-email">Email do Cliente</Label>
                          <Input
                            id="client-email"
                            type="email"
                            placeholder="cliente@email.com"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                          />
                        </div>
                        <Button 
                          onClick={handleSendEmail} 
                          disabled={sendingEmail}
                          className="w-full"
                        >
                          {sendingEmail ? "Enviando..." : "Enviar Email"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Enviar por WhatsApp
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Relatório por WhatsApp</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="client-phone">Telefone do Cliente</Label>
                          <Input
                            id="client-phone"
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                          />
                        </div>
                        <Button 
                          onClick={handleSendWhatsApp}
                          className="w-full"
                        >
                          Abrir WhatsApp
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button onClick={handleExportClientPDF} variant="outline">
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {clientMonthlyServices.map((service) => (
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
                      {clientMonthlyServices.map((service) => (
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

            {selectedClient && selectedClientMonth && clientMonthlyServices.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum serviço encontrado para este cliente neste período.
              </p>
            )}
          </div>
        )}

        {!consolidatedMode && !clientReportMode && selectedMonth && monthlyServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para este mês.
          </p>
        )}

        {consolidatedMode && selectedMonths.length > 0 && consolidatedServices.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Nenhum serviço encontrado para os meses selecionados.
          </p>
        )}
          </>
        )}
      </CardContent>

      {/* Edit Service Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Serviço</Label>
              <Input
                value={editForm.service_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, service_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.service_value}
                onChange={(e) => setEditForm(prev => ({ ...prev, service_value: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Paciente</Label>
              <Input
                value={editForm.patient_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, patient_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <Input
                value={editForm.color}
                onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
