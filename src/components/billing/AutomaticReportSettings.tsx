import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Mail, MessageCircle, Calendar } from "lucide-react";
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
}

interface AutomaticReportSettingsProps {
  services: Service[];
}

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
          ? "Agendamento ativado com sucesso!"
          : "Agendamento desativado com sucesso!"
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

      toast.success("Agendamento excluído com sucesso!");
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
  };

  const availableClients = getAvailableClients();
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Envio Automático de Relatórios</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Agendamento Automático</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
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
                  <Label>Dia do Mês para Envio</Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    O relatório do mês anterior será enviado neste dia
                  </p>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <Label htmlFor="send-email">Enviar por Email</Label>
                    </div>
                    <Switch
                      id="send-email"
                      checked={sendViaEmail}
                      onCheckedChange={setSendViaEmail}
                    />
                  </div>

                  {sendViaEmail && (
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
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <Label htmlFor="send-whatsapp">Enviar por WhatsApp</Label>
                    </div>
                    <Switch
                      id="send-whatsapp"
                      checked={sendViaWhatsApp}
                      onCheckedChange={setSendViaWhatsApp}
                    />
                  </div>

                  {sendViaWhatsApp && (
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
                  )}
                </div>

                <Button
                  onClick={handleAddSchedule}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Salvando..." : "Criar Agendamento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum agendamento automático configurado
            </p>
            <p className="text-sm text-muted-foreground">
              Configure o envio automático de relatórios mensais para seus clientes
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{schedule.client_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Todo dia {schedule.day_of_month} do mês
                        </p>
                      </div>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(schedule.id, schedule.is_active)
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
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

                    {schedule.last_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Último envio:{" "}
                        {new Date(schedule.last_sent_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop view */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead>Dia do Mês</TableHead>
                    <TableHead>Último Envio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.client_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {schedule.send_via_email && (
                            <Badge variant="secondary">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          {schedule.send_via_whatsapp && (
                            <Badge variant="secondary">
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
