import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Loader2, Wrench, DollarSign, TrendingUp, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmployeeServiceForm } from "@/components/employee/EmployeeServiceForm";
import { EmployeeProductionExport } from "@/components/employee/EmployeeProductionExport";
import { EmployeeGoals, type GoalProgressItem } from "@/components/employee/EmployeeGoals";
import { EmployeeGoalAlerts } from "@/components/employee/EmployeeGoalAlerts";
import { EmployeeWorkActions } from "@/components/employee/EmployeeWorkActions";
import { EmployeeDocumentScanner } from "@/components/employee/EmployeeDocumentScanner";
import { useGoalNotifications } from "@/hooks/useGoalNotifications";

interface WorkRecord {
  id: string;
  work_type: string;
  patient_name: string | null;
  value: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  deadline: string | null;
  color: string | null;
  notes: string | null;
}

interface EmployeeInfo {
  id: string;
  name: string;
  role: string;
  user_id: string;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgressItem[]>([]);

  const handleProgressChange = useCallback((list: GoalProgressItem[]) => {
    setGoalProgress(list);
  }, []);

  // Goal toast notifications
  useGoalNotifications(goalProgress.map(p => ({
    goal: p.goal,
    currentQuantity: p.currentQuantity,
    currentValue: p.currentValue,
    quantityPercent: p.quantityPercent,
    valuePercent: p.valuePercent,
    employeeName: employeeInfo?.name,
  })));

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/employee-login');
      return;
    }
    fetchEmployeeInfo();
  }, [user, authLoading]);

  useEffect(() => {
    if (!employeeInfo) return;
    fetchWorkRecords();
    const channel = supabase
      .channel('employee-work-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_records' }, () => {
        fetchWorkRecords();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [employeeInfo]);

  const fetchEmployeeInfo = async () => {
    try {
      // Get employee record linked to this auth user
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, role, user_id')
        .eq('auth_user_id', user!.id)
        .limit(1);

      if (!employees || employees.length === 0) {
        // No employee record found - not a valid employee
        await signOut();
        navigate('/employee-login');
        return;
      }

      setEmployeeInfo(employees[0]);
    } catch (error) {
      console.error('Error fetching employee info:', error);
      navigate('/employee-login');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkRecords = async () => {
    if (!employeeInfo) return;
    const { data, error } = await supabase
      .from('work_records')
      .select('*')
      .eq('employee_id', employeeInfo.id)
      .order('start_date', { ascending: false });

    if (!error && data) setWorkRecords(data);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/employee-login');
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      in_progress: { label: "Em andamento", variant: "default" },
      finished: { label: "Finalizado", variant: "secondary" },
      pending: { label: "Pendente", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const totalValue = workRecords.reduce((sum, r) => sum + (r.value || 0), 0);
  const pendingValue = workRecords.filter(r => r.status !== 'finished').reduce((sum, r) => sum + (r.value || 0), 0);
  const finishedCount = workRecords.filter(r => r.status === 'finished').length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Portal do Funcionário</h1>
          <p className="text-muted-foreground">Bem-vindo, {employeeInfo?.name}</p>
        </div>
        <Button onClick={handleLogout} variant="outline" size="sm">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Trabalhos Finalizados</p>
                <p className="text-2xl font-bold">{finishedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total a Receber</p>
                <p className="text-2xl font-bold">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-accent-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold">
                  {pendingValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Goals */}
      {employeeInfo && (
        <>
          <EmployeeGoalAlerts progressList={goalProgress} />
          <EmployeeGoals
            employeeId={employeeInfo.id}
            ownerUserId={employeeInfo.user_id}
            workRecords={workRecords}
            onProgressChange={handleProgressChange}
          />
        </>
      )}

      <Tabs defaultValue="production" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="production">Minha Produção</TabsTrigger>
          <TabsTrigger value="scanner" className="flex items-center gap-1">
            <ScanLine className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="add-service">Adicionar Serviço</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <EmployeeProductionExport
              workRecords={workRecords}
              employeeName={employeeInfo?.name || "Funcionário"}
            />
          </div>
          {workRecords.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum trabalho registrado ainda.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meus Trabalhos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Finalização</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.work_type}</TableCell>
                          <TableCell>{record.patient_name || "-"}</TableCell>
                          <TableCell>{record.color || "-"}</TableCell>
                          <TableCell>
                            {record.value
                              ? record.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            {format(new Date(record.start_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {record.end_date
                              ? format(new Date(record.end_date), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <EmployeeWorkActions record={record} onUpdated={fetchWorkRecords} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scanner" className="mt-4">
          {employeeInfo && (
            <EmployeeDocumentScanner
              ownerUserId={employeeInfo.user_id}
              employeeId={employeeInfo.id}
              employeeName={employeeInfo.name}
              onScanComplete={fetchWorkRecords}
            />
          )}
        </TabsContent>

        <TabsContent value="add-service" className="mt-4">
          {employeeInfo && (
            <EmployeeServiceForm
              ownerUserId={employeeInfo.user_id}
              employeeName={employeeInfo.name}
              employeeId={employeeInfo.id}
              onServiceAdded={fetchWorkRecords}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
