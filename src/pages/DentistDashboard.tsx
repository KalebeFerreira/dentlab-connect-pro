import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, BellOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DentistAppointmentsList } from "@/components/clinic/DentistAppointmentsList";
import { DentistMonthlyReport } from "@/components/clinic/DentistMonthlyReport";
import { useAppointmentNotifications } from "@/hooks/useAppointmentNotifications";

export default function DentistDashboard() {
  const navigate = useNavigate();
  const [dentistInfo, setDentistInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

      {/* Tabs for Appointments and Monthly Report */}
      {dentistInfo && (
        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="appointments">Meus Agendamentos</TabsTrigger>
            <TabsTrigger value="report">Relatório Mensal</TabsTrigger>
          </TabsList>
          <TabsContent value="appointments" className="space-y-4">
            <DentistAppointmentsList dentistId={dentistInfo.id} />
          </TabsContent>
          <TabsContent value="report" className="space-y-4">
            <DentistMonthlyReport dentistId={dentistInfo.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
