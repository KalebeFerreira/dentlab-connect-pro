import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trash2, TrendingUp, Users, Building2 } from "lucide-react";
import type { Employee } from "./EmployeeManagement";
import type { WorkRecord } from "./WorkRecordManagement";
import { useProductionGoals, type GoalProgress } from "@/hooks/useProductionGoals";
import { useGoalNotifications } from "@/hooks/useGoalNotifications";

interface ProductionGoalsProps {
  employees: Employee[];
  workRecords: WorkRecord[];
  userId: string;
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  annual: "Anual",
};

export const ProductionGoals = ({ employees, workRecords, userId }: ProductionGoalsProps) => {
  const { goals, saveGoal, deleteGoal, getGoalProgress } = useProductionGoals(userId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("lab");

  const [formData, setFormData] = useState({
    goal_type: "monthly",
    employee_id: "",
    target_quantity: "",
    target_value: "",
  });

  const progressList: GoalProgress[] = useMemo(
    () => getGoalProgress(workRecords, employees),
    [goals, workRecords, employees]
  );

  // Notifications
  useGoalNotifications(progressList);

  const labGoals = progressList.filter((p) => !p.goal.employee_id);
  const employeeGoals = progressList.filter((p) => !!p.goal.employee_id);

  const handleOpenDialog = (employeeId?: string) => {
    setFormData({
      goal_type: "monthly",
      employee_id: employeeId || "",
      target_quantity: "",
      target_value: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.target_quantity && !formData.target_value) {
      return;
    }
    await saveGoal({
      goal_type: formData.goal_type as "weekly" | "monthly" | "annual",
      employee_id: formData.employee_id === "lab" ? null : (formData.employee_id || null),
      target_quantity: parseInt(formData.target_quantity) || 0,
      target_value: parseFloat(formData.target_value) || 0,
    });
    setDialogOpen(false);
  };

  const activeEmployees = employees.filter((e) => e.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Metas de Produção
        </h3>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Meta
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lab" className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            Laboratório
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Funcionários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab" className="mt-4 space-y-4">
          {labGoals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhuma meta do laboratório definida</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => handleOpenDialog()}>
                  Definir Meta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {labGoals.map((p) => (
                <GoalCard key={p.goal.id} progress={p} onDelete={deleteGoal} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="employees" className="mt-4 space-y-4">
          {employeeGoals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhuma meta por funcionário definida</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => handleOpenDialog()}>
                  Definir Meta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {employeeGoals.map((p) => (
                <GoalCard key={p.goal.id} progress={p} onDelete={deleteGoal} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para criar/editar meta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Meta de Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Meta</Label>
              <Select value={formData.goal_type} onValueChange={(v) => setFormData({ ...formData, goal_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <Select value={formData.employee_id} onValueChange={(v) => setFormData({ ...formData, employee_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab">🏢 Laboratório (geral)</SelectItem>
                  {activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      👤 {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_quantity">Meta de Trabalhos</Label>
                <Input
                  id="target_quantity"
                  type="number"
                  min="0"
                  value={formData.target_quantity}
                  onChange={(e) => setFormData({ ...formData, target_quantity: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_value">Meta de Valor (R$)</Label>
                <Input
                  id="target_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  placeholder="Ex: 10000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-component for goal card
function GoalCard({ progress, onDelete }: { progress: GoalProgress; onDelete: (id: string) => void }) {
  const { goal, currentQuantity, currentValue, quantityPercent, valuePercent, employeeName } = progress;

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "text-primary";
    if (percent >= 80) return "text-accent-foreground";
    if (percent >= 50) return "text-secondary-foreground";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {employeeName ? (
              <Users className="h-4 w-4 text-primary" />
            ) : (
              <Building2 className="h-4 w-4 text-primary" />
            )}
            <CardTitle className="text-sm font-medium">
              {employeeName || "Laboratório"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {GOAL_TYPE_LABELS[goal.goal_type]}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(goal.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {goal.target_quantity > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trabalhos finalizados</span>
              <span className={`font-medium ${getStatusColor(quantityPercent)}`}>
                {currentQuantity}/{goal.target_quantity}
              </span>
            </div>
            <Progress value={quantityPercent} className="h-2" />
            <p className={`text-xs text-right font-medium ${getStatusColor(quantityPercent)}`}>
              {quantityPercent.toFixed(0)}%
            </p>
          </div>
        )}

        {goal.target_value > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor</span>
              <span className={`font-medium ${getStatusColor(valuePercent)}`}>
                {currentValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /{" "}
                {goal.target_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <Progress value={valuePercent} className="h-2" />
            <p className={`text-xs text-right font-medium ${getStatusColor(valuePercent)}`}>
              {valuePercent.toFixed(0)}%
            </p>
          </div>
        )}

        {quantityPercent >= 100 || valuePercent >= 100 ? (
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            Meta atingida! 🎉
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
