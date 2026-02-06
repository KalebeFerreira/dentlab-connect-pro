import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Pencil, Trash2, Filter, UserCheck, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Employee {
  id: string;
  user_id: string;
  name: string;
  role: string;
  status: string;
  notes: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

const EMPLOYEE_ROLES = [
  { value: "ceramista", label: "Ceramista" },
  { value: "protetico", label: "Protético" },
  { value: "acabamento", label: "Acabamento" },
  { value: "modelagem", label: "Modelagem" },
  { value: "gesso", label: "Gesseiro" },
  { value: "cad_cam", label: "CAD/CAM" },
  { value: "administrativo", label: "Administrativo" },
  { value: "entrega", label: "Entregador" },
  { value: "outros", label: "Outros" },
];

interface EmployeeManagementProps {
  employees: Employee[];
  onRefresh: () => void;
}

export const EmployeeManagement = ({ employees, onRefresh }: EmployeeManagementProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [filterRole, setFilterRole] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  
  const [formData, setFormData] = useState({
    name: "",
    role: "protetico",
    status: "active",
    notes: "",
    phone: "",
    email: "",
  });

  // Realtime subscription for automatic updates
  useEffect(() => {
    const channel = supabase
      .channel('employees-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees'
        },
        () => {
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  const filteredEmployees = employees.filter(emp => {
    const roleMatch = filterRole === "todos" || emp.role === filterRole;
    const statusMatch = filterStatus === "todos" || emp.status === filterStatus;
    return roleMatch && statusMatch;
  });

  const activeCount = employees.filter(e => e.status === "active").length;

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        role: employee.role,
        status: employee.status,
        notes: employee.notes || "",
        phone: employee.phone || "",
        email: employee.email || "",
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: "", role: "protetico", status: "active", notes: "", phone: "", email: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update({
            name: formData.name,
            role: formData.role,
            status: formData.status,
            notes: formData.notes || null,
            phone: formData.phone || null,
            email: formData.email || null,
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;
        toast.success("Funcionário atualizado!");
      } else {
        const { error } = await supabase
          .from("employees")
          .insert({
            user_id: user.id,
            name: formData.name,
            role: formData.role,
            status: formData.status,
            notes: formData.notes || null,
            phone: formData.phone || null,
            email: formData.email || null,
          });

        if (error) throw error;
        toast.success("Funcionário cadastrado!");
      }

      setDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Excluir funcionário "${employee.name}"? Isso também removerá todos os trabalhos associados.`)) return;

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employee.id);

      if (error) throw error;
      toast.success("Funcionário excluído!");
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const getRoleLabel = (role: string) => {
    return EMPLOYEE_ROLES.find(r => r.value === role)?.label || role;
  };

  // Mobile card view for employees
  const MobileEmployeeList = () => (
    <div className="space-y-3">
      {filteredEmployees.map(employee => (
        <Card key={employee.id} className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{employee.name}</p>
              <p className="text-sm text-muted-foreground">{getRoleLabel(employee.role)}</p>
              <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
                {employee.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {employee.phone}
                  </span>
                )}
                {employee.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" />
                    {employee.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={employee.status === "active" ? "default" : "secondary"} className="text-xs">
                {employee.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenDialog(employee)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(employee)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  // Conteúdo do formulário extraído para ser usado diretamente
  const formContent = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nome do funcionário"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Função</Label>
          <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_ROLES.map(role => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Observações opcionais..."
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Funcionários
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              {activeCount} ativos
            </Badge>
            <Button onClick={() => handleOpenDialog()} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas funções</SelectItem>
                  {EMPLOYEE_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum funcionário encontrado
            </div>
          ) : isMobile ? (
            <MobileEmployeeList />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[120px]">Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map(employee => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium max-w-[120px] truncate" title={employee.name}>{employee.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {employee.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[90px]">{employee.phone}</span>
                            </span>
                          )}
                          {employee.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[90px]">{employee.email}</span>
                            </span>
                          )}
                          {!employee.phone && !employee.email && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleLabel(employee.role)}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                          {employee.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(employee.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(employee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(employee)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile: Drawer, Desktop: Dialog */}
      {isMobile ? (
        <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 max-h-[60vh] overflow-y-auto">
              {formContent}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
              </DialogTitle>
            </DialogHeader>
            {formContent}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
