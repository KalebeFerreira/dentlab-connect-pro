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
 import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Pencil, Trash2, Filter, UserCheck, Phone, Mail } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
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
   
   const [formData, setFormData] = useState({
     name: "",
     role: "protetico",
     status: "active",
     notes: "",
    phone: "",
    email: "",
   });
 
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
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
           <CardTitle className="flex items-center gap-2">
             <Users className="h-5 w-5" />
             Funcionários
           </CardTitle>
           <div className="flex items-center gap-2">
             <Badge variant="secondary" className="flex items-center gap-1">
               <UserCheck className="h-3 w-3" />
               {activeCount} ativos
             </Badge>
             <Button onClick={() => handleOpenDialog()} size="sm">
               <Plus className="h-4 w-4 mr-1" />
               Adicionar
             </Button>
           </div>
         </CardHeader>
         <CardContent>
           <div className="flex flex-wrap gap-3 mb-4">
             <div className="flex items-center gap-2">
               <Filter className="h-4 w-4 text-muted-foreground" />
               <Select value={filterRole} onValueChange={setFilterRole}>
                 <SelectTrigger className="w-[150px]">
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
               <SelectTrigger className="w-[130px]">
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
 
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>
               {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
             </DialogTitle>
           </DialogHeader>
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
            <div className="grid grid-cols-2 gap-4">
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
             <div className="grid grid-cols-2 gap-4">
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
     </div>
   );
 };