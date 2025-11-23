import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, FileText, LogOut, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DentistAppointmentsList } from "@/components/clinic/DentistAppointmentsList";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";

export default function DentistDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dentistInfo, setDentistInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    upcomingAppointments: 0,
    totalEarnings: 0,
  });

  const { permission, requestPermission } = useAppointmentNotifications(dentistInfo?.id || null);

  useEffect(() => {
    checkDentistAuth();
  }, []);

  const checkDentistAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user has dentist role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'dentist')
        .single();

      if (!roles) {
        console.error('User does not have dentist role');
        navigate('/dashboard');
        return;
      }

      // Get dentist info
      const { data: dentists } = await supabase
        .from('dentists')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (!dentists || dentists.length === 0) {
        console.error('Dentist profile not found');
        navigate('/dashboard');
        return;
      }

      const dentist = dentists[0];

      setDentistInfo(dentist);

      // Get statistics
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('dentist_id', dentist.id);

      if (appointments) {
        const now = new Date();
        const upcoming = appointments.filter(apt => new Date(apt.appointment_date) > now);
        const totalPayment = appointments.reduce((sum, apt) => sum + (apt.dentist_payment || 0), 0);

        setStats({
          totalAppointments: appointments.length,
          upcomingAppointments: upcoming.length,
          totalEarnings: totalPayment,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking dentist auth:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard do Dentista</h1>
          <p className="text-muted-foreground">
            Bem-vindo, Dr(a). {dentistInfo?.name}
          </p>
        </div>
        <div className="flex gap-2">
          {permission !== 'granted' && (
            <Button onClick={requestPermission} variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações
            </Button>
          )}
          {permission === 'granted' && (
            <Button variant="outline" size="sm" disabled>
              <BellOff className="h-4 w-4 mr-2" />
              Notificações Ativas
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Agendamentos
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAppointments}</div>
            <p className="text-xs text-muted-foreground">
              Todos os agendamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximos Agendamentos
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground">
              Agendamentos futuros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total a Receber
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total dos procedimentos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      {dentistInfo && (
        <DentistAppointmentsList dentistId={dentistInfo.id} />
      )}
    </div>
  );
}
