import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Mail, MessageCircle, Calendar, FileText, FileSpreadsheet, FileImage, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Service } from "@/pages/Billing";

interface AutomaticReportSchedule {
  id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  send_via_email: boolean;
  send_via_whatsapp: boolean;
  day_of_month: number;
  is_active: boolean;
  last_sent_at?: string;
  report_format?: string;
}

interface AutomaticReportSettingsProps {
  services: Service[];
}

const REPORT_FORMATS = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'word', label: 'Word', icon: FileText },
  { value: 'jpg', label: 'JPG', icon: FileImage },
  { value: 'png', label: 'PNG', icon: FileImage },
];

export const AutomaticReportSettings = ({ services }: AutomaticReportSettingsProps) => {
  const [schedules, setSchedules] = useState<AutomaticReportSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sendViaEmail, setSendViaEmail] = useState(true);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [reportFormat, setReportFormat] = useState("pdf");

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("automatic_report_schedules")
        .select("*")
        .order("client_name", { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    }
  };

  const getAvailableClients = () => {
    const clients = new Set<string>();
    services.forEach((service) => {
      if (service.client_name) {
        clients.add(service.client_name);
      }
    });
    return Array.from(clients).sort();
  };

  const handleAddSchedule = async () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente");
      return;
    }

    if (!sendViaEmail && !sendViaWhatsApp) {
      toast.error("Selecione pelo menos um canal de envio");
      return;
    }

    if (sendViaEmail && !clientEmail) {
      toast.error("Email é obrigatório quando envio por email está ativado");
      return;
    }

    if (sendViaWhatsApp && !clientPhone) {
      toast.error("Telefone é obrigatório quando envio por WhatsApp está ativado");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("automatic_report_schedules")
        .insert({
          user_id: user.id,
          client_name: selectedClient,
          client_email: sendViaEmail ? clientEmail : null,
          client_phone: sendViaWhatsApp ? clientPhone : null,
          send_via_email: sendViaEmail,
          send_via_whatsapp: sendViaWhatsApp,
          day_of_month: parseInt(dayOfMonth),
          is_active: true,
          report_format: reportFormat,
        });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      setDialogOpen(false);
      resetForm();
      loadSchedules();
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("automatic_report_schedules")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(
        !currentStatus
          ? "Agendamento ativado!"
          : "Agendamento desativado!"
      );
      loadSchedules();
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;

    try {
      const { error } = await supabase
        .from("automatic_report_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Agendamento excluído!");
      loadSchedules();
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      toast.error("Erro ao excluir agendamento");
    }
  };

  const resetForm = () => {
    setSelectedClient("");
    setClientEmail("");
    setClientPhone("");
    setSendViaEmail(true);
    setSendViaWhatsApp(false);
    setDayOfMonth("1");
    setReportFormat("pdf");
  };

  const getFormatIcon = (format: string) => {
    const formatInfo = REPORT_FORMATS.find(f => f.value === format);
    if (!formatInfo) return null;
    const Icon = formatInfo.icon;
    return <Icon className="h-3 w-3" />;
  };

  const getFormatLabel = (format: string) => {
    return REPORT_FORMATS.find(f => f.value === format)?.label || format.toUpperCase();
  };

  const availableClients = getAvailableClients();
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">Envio Automático de Relatórios</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-base">Novo Agendamento Automático</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Cliente</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger className="h-10">
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

                  <div className="space-y-1.5">
                    <Label className="text-sm">Dia do Mês para Envio</Label>
                    <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione o dia" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            Dia {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Relatório do mês anterior será enviado neste dia
                    </p>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-sm font-medium">Formato do Relatório</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {REPORT_FORMATS.map((format) => {
                        const Icon = format.icon;
                        return (
                          <Button
                            key={format.value}
                            type="button"
                            variant={reportFormat === format.value ? "default" : "outline"}
                            size="sm"
                            className="flex flex-col items-center gap-1 h-auto py-2 px-2"
                            onClick={() => setReportFormat(format.value)}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-xs">{format.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    <Label className="text-sm font-medium">Canais de Envio</Label>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="send-email" className="text-sm font-normal">Email</Label>
                        </div>
                        <Switch
                          id="send-email"
                          checked={sendViaEmail}
                          onCheckedChange={setSendViaEmail}
                        />
                      </div>

                      {sendViaEmail && (
                        <Input
                          type="email"
                          placeholder="cliente@email.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="h-10"
                        />
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="send-whatsapp" className="text-sm font-normal">WhatsApp</Label>
                        </div>
                        <Switch
                          id="send-whatsapp"
                          checked={sendViaWhatsApp}
                          onCheckedChange={setSendViaWhatsApp}
                        />
                      </div>

                      {sendViaWhatsApp && (
                        <Input
                          type="tel"
                          placeholder="(00) 00000-0000"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="h-10"
                        />
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleAddSchedule}
                    disabled={loading}
                    className="w-full h-11"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Criar Agendamento"
                    )}
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground mb-2">
              Nenhum agendamento configurado
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Configure o envio automático de relatórios para seus clientes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate">{schedule.client_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Dia {schedule.day_of_month} do mês
                        </p>
                      </div>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(schedule.id, schedule.is_active)
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        {getFormatIcon(schedule.report_format || 'pdf')}
                        <span className="ml-1">{getFormatLabel(schedule.report_format || 'pdf')}</span>
                      </Badge>
                      {schedule.send_via_email && (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Badge>
                      )}
                      {schedule.send_via_whatsapp && (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          <MessageCircle className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Badge>
                      )}
                    </div>

                    {schedule.last_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Último envio: {new Date(schedule.last_sent_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="w-full h-9"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Último Envio</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.client_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getFormatIcon(schedule.report_format || 'pdf')}
                          <span className="ml-1">{getFormatLabel(schedule.report_format || 'pdf')}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {schedule.send_via_email && (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          {schedule.send_via_whatsapp && (
                            <Badge variant="secondary" className="text-xs">
                              <MessageCircle className="h-3 w-3 mr-1" />
                              WhatsApp
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>Dia {schedule.day_of_month}</TableCell>
                      <TableCell>
                        {schedule.last_sent_at
                          ? new Date(schedule.last_sent_at).toLocaleDateString("pt-BR")
                          : "Nunca"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() =>
                            handleToggleActive(schedule.id, schedule.is_active)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
