import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, MessageCircle } from "lucide-react";
import { NotificationSettings } from "@/components/NotificationSettings";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  duration_minutes: number;
  type: string;
  status: string;
  notes: string | null;
  whatsapp_sent: boolean;
  whatsapp_confirmed: boolean;
  patients: Patient;
}

const Appointments = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    patient_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: "60",
    type: "consulta",
    status: "scheduled",
    notes: "",
  });

  useEffect(() => {
    checkAuth();
    loadPatients();
    loadAppointments();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, phone")
        .order("name");

      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar pacientes", { description: error.message });
    }
  };

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          patients (id, name, phone)
        `)
        .order("appointment_date", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar agendamentos", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const appointmentDateTime = `${formData.appointment_date}T${formData.appointment_time}:00`;

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update({
            patient_id: formData.patient_id,
            appointment_date: appointmentDateTime,
            duration_minutes: parseInt(formData.duration_minutes),
            type: formData.type,
            status: formData.status,
            notes: formData.notes || null,
          })
          .eq("id", editingAppointment.id);

        if (error) throw error;
        toast.success("Agendamento atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("appointments").insert({
          user_id: user.id,
          patient_id: formData.patient_id,
          appointment_date: appointmentDateTime,
          duration_minutes: parseInt(formData.duration_minutes),
          type: formData.type,
          status: formData.status,
          notes: formData.notes || null,
        });

        if (error) throw error;
        toast.success("Agendamento criado com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      loadAppointments();
    } catch (error: any) {
      toast.error("Erro ao salvar agendamento", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const date = new Date(appointment.appointment_date);
    setFormData({
      patient_id: appointment.patient_id,
      appointment_date: date.toISOString().split("T")[0],
      appointment_time: date.toTimeString().slice(0, 5),
      duration_minutes: appointment.duration_minutes.toString(),
      type: appointment.type,
      status: appointment.status,
      notes: appointment.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;

    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Agendamento excluído com sucesso!");
      loadAppointments();
    } catch (error: any) {
      toast.error("Erro ao excluir agendamento", { description: error.message });
    }
  };

  const resetForm = () => {
    setEditingAppointment(null);
    setFormData({
      patient_id: "",
      appointment_date: "",
      appointment_time: "",
      duration_minutes: "60",
      type: "consulta",
      status: "scheduled",
      notes: "",
    });
  };

  const sendWhatsAppReminder = async (appointment: Appointment) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar template de lembrete de agendamento
      const { data: templates, error: templateError } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("template_type", "appointment_reminder")
        .eq("is_active", true)
        .limit(1);

      if (templateError) throw templateError;

      let message = "";
      if (templates && templates.length > 0) {
        // Usar template personalizado
        const appointmentDate = new Date(appointment.appointment_date);
        message = templates[0].message_content
          .replace(/{patient_name}/g, appointment.patients.name)
          .replace(/{appointment_date}/g, appointmentDate.toLocaleDateString('pt-BR'))
          .replace(/{appointment_time}/g, appointmentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
          .replace(/{appointment_type}/g, appointment.type);
      } else {
        // Usar mensagem padrão
        const appointmentDate = new Date(appointment.appointment_date);
        message = `Olá ${appointment.patients.name}! Lembrando seu agendamento para ${appointmentDate.toLocaleDateString('pt-BR')} às ${appointmentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Tipo: ${appointment.type}`;
      }

      // Limpar número de telefone e criar link do WhatsApp
      const phone = appointment.patients.phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
      
      // Abrir WhatsApp
      window.open(whatsappUrl, '_blank');

      // Marcar como enviado
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ whatsapp_sent: true })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      toast.success("WhatsApp aberto com a mensagem!");
      loadAppointments();
    } catch (error: any) {
      toast.error("Erro ao enviar lembrete", { description: error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "default",
      confirmed: "secondary",
      cancelled: "destructive",
      completed: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <NotificationSettings />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Agendamentos</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAppointment ? "Editar" : "Novo"} Agendamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="patient_id">Paciente *</Label>
                <Select
                  value={formData.patient_id}
                  onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="appointment_date">Data *</Label>
                  <Input
                    id="appointment_date"
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="appointment_time">Horário *</Label>
                  <Input
                    id="appointment_time"
                    type="time"
                    required
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="procedimento">Procedimento</SelectItem>
                      <SelectItem value="emergencia">Emergência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration_minutes">Duração (min) *</Label>
                  <Input
                    id="duration_minutes"
                    type="number"
                    min="15"
                    step="15"
                    required
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAppointment ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Agendamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum agendamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">{appointment.patients.name}</TableCell>
                    <TableCell>
                      {new Date(appointment.appointment_date).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{appointment.type}</TableCell>
                    <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendWhatsAppReminder(appointment)}
                        title="Enviar lembrete via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(appointment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(appointment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Appointments;
