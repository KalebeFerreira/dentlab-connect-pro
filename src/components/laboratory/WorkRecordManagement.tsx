 import { useState } from "react";
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
 import { ClipboardList, Plus, Pencil, Trash2, Filter, Calendar } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import type { Employee } from "./EmployeeManagement";
 
 export interface WorkRecord {
   id: string;
   user_id: string;
   employee_id: string;
   work_type: string;
   work_code: string | null;
   start_date: string;
   end_date: string | null;
   status: string;
   notes: string | null;
   created_at: string;
   updated_at: string;
   employees?: { name: string };
 }
 
 const WORK_TYPES = [
   { value: "coroa", label: "Coroa" },
   { value: "protese_total", label: "Prótese Total" },
   { value: "protese_parcial", label: "Prótese Parcial Removível" },
   { value: "protese_fixa", label: "Prótese Fixa" },
   { value: "faceta", label: "Faceta" },
   { value: "onlay", label: "Onlay" },
   { value: "inlay", label: "Inlay" },
   { value: "placa_oclusao", label: "Placa de Oclusão" },
   { value: "provisorio", label: "Provisório" },
   { value: "modelo", label: "Modelo" },
   { value: "nucleo", label: "Núcleo" },
   { value: "implante", label: "Trabalho sobre Implante" },
   { value: "outros", label: "Outros" },
 ];
 
 interface WorkRecordManagementProps {
   workRecords: WorkRecord[];
   employees: Employee[];
   onRefresh: () => void;
 }
 
 export const WorkRecordManagement = ({ workRecords, employees, onRefresh }: WorkRecordManagementProps) => {
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editingRecord, setEditingRecord] = useState<WorkRecord | null>(null);
   const [filterEmployee, setFilterEmployee] = useState<string>("todos");
   const [filterStatus, setFilterStatus] = useState<string>("todos");
   const [saving, setSaving] = useState(false);
 
   const [formData, setFormData] = useState({
     employee_id: "",
     work_type: "coroa",
     work_code: "",
     start_date: format(new Date(), "yyyy-MM-dd"),
     end_date: "",
     status: "in_progress",
     notes: "",
   });
 
   const filteredRecords = workRecords.filter(rec => {
     const employeeMatch = filterEmployee === "todos" || rec.employee_id === filterEmployee;
     const statusMatch = filterStatus === "todos" || rec.status === filterStatus;
     return employeeMatch && statusMatch;
   });
 
   const handleOpenDialog = (record?: WorkRecord) => {
     if (record) {
       setEditingRecord(record);
       setFormData({
         employee_id: record.employee_id,
         work_type: record.work_type,
         work_code: record.work_code || "",
         start_date: record.start_date,
         end_date: record.end_date || "",
         status: record.status,
         notes: record.notes || "",
       });
     } else {
       setEditingRecord(null);
       setFormData({
         employee_id: employees[0]?.id || "",
         work_type: "coroa",
         work_code: "",
         start_date: format(new Date(), "yyyy-MM-dd"),
         end_date: "",
         status: "in_progress",
         notes: "",
       });
     }
     setDialogOpen(true);
   };
 
   const handleSave = async () => {
     if (!formData.employee_id) {
       toast.error("Selecione um funcionário");
       return;
     }
 
     try {
       setSaving(true);
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error("Usuário não autenticado");
 
       const payload = {
         employee_id: formData.employee_id,
         work_type: formData.work_type,
         work_code: formData.work_code || null,
         start_date: formData.start_date,
         end_date: formData.end_date || null,
         status: formData.status,
         notes: formData.notes || null,
       };
 
       if (editingRecord) {
         const { error } = await supabase
           .from("work_records")
           .update(payload)
           .eq("id", editingRecord.id);
 
         if (error) throw error;
         toast.success("Trabalho atualizado!");
       } else {
         const { error } = await supabase
           .from("work_records")
           .insert({ ...payload, user_id: user.id });
 
         if (error) throw error;
         toast.success("Trabalho registrado!");
       }
 
       setDialogOpen(false);
       onRefresh();
     } catch (error: any) {
       toast.error("Erro ao salvar", { description: error.message });
     } finally {
       setSaving(false);
     }
   };
 
   const handleDelete = async (record: WorkRecord) => {
     if (!confirm("Excluir este registro de trabalho?")) return;
 
     try {
       const { error } = await supabase
         .from("work_records")
         .delete()
         .eq("id", record.id);
 
       if (error) throw error;
       toast.success("Registro excluído!");
       onRefresh();
     } catch (error: any) {
       toast.error("Erro ao excluir", { description: error.message });
     }
   };
 
   const getWorkTypeLabel = (type: string) => {
     return WORK_TYPES.find(t => t.value === type)?.label || type;
   };
 
   const getEmployeeName = (employeeId: string) => {
     return employees.find(e => e.id === employeeId)?.name || "Desconhecido";
   };
 
   const activeEmployees = employees.filter(e => e.status === "active");
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
           <CardTitle className="flex items-center gap-2">
             <ClipboardList className="h-5 w-5" />
             Trabalhos Executados
           </CardTitle>
           <Button onClick={() => handleOpenDialog()} size="sm" disabled={activeEmployees.length === 0}>
             <Plus className="h-4 w-4 mr-1" />
             Lançar Trabalho
           </Button>
         </CardHeader>
         <CardContent>
           {activeEmployees.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               Cadastre funcionários ativos primeiro para lançar trabalhos
             </div>
           ) : (
             <>
               <div className="flex flex-wrap gap-3 mb-4">
                 <div className="flex items-center gap-2">
                   <Filter className="h-4 w-4 text-muted-foreground" />
                   <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                     <SelectTrigger className="w-[180px]">
                       <SelectValue placeholder="Funcionário" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="todos">Todos funcionários</SelectItem>
                       {employees.map(emp => (
                         <SelectItem key={emp.id} value={emp.id}>
                           {emp.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <Select value={filterStatus} onValueChange={setFilterStatus}>
                   <SelectTrigger className="w-[150px]">
                     <SelectValue placeholder="Status" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="todos">Todos</SelectItem>
                     <SelectItem value="in_progress">Em Andamento</SelectItem>
                     <SelectItem value="finished">Finalizado</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               {filteredRecords.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   Nenhum trabalho encontrado
                 </div>
               ) : (
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Funcionário</TableHead>
                         <TableHead>Tipo</TableHead>
                         <TableHead>Código</TableHead>
                         <TableHead>Início</TableHead>
                         <TableHead>Fim</TableHead>
                         <TableHead>Status</TableHead>
                         <TableHead className="text-right">Ações</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {filteredRecords.map(record => (
                         <TableRow key={record.id}>
                           <TableCell className="font-medium">
                             {getEmployeeName(record.employee_id)}
                           </TableCell>
                           <TableCell>{getWorkTypeLabel(record.work_type)}</TableCell>
                           <TableCell>{record.work_code || "-"}</TableCell>
                           <TableCell>
                             {format(new Date(record.start_date), "dd/MM/yyyy", { locale: ptBR })}
                           </TableCell>
                           <TableCell>
                             {record.end_date
                               ? format(new Date(record.end_date), "dd/MM/yyyy", { locale: ptBR })
                               : "-"}
                           </TableCell>
                           <TableCell>
                             <Badge variant={record.status === "finished" ? "default" : "secondary"}>
                               {record.status === "finished" ? "Finalizado" : "Em Andamento"}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right">
                             <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(record)}>
                               <Pencil className="h-4 w-4" />
                             </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleDelete(record)}>
                               <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
               )}
             </>
           )}
         </CardContent>
       </Card>
 
       <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>
               {editingRecord ? "Editar Trabalho" : "Lançar Novo Trabalho"}
             </DialogTitle>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Funcionário *</Label>
               <Select value={formData.employee_id} onValueChange={(v) => setFormData({ ...formData, employee_id: v })}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione o funcionário" />
                 </SelectTrigger>
                 <SelectContent>
                   {activeEmployees.map(emp => (
                     <SelectItem key={emp.id} value={emp.id}>
                       {emp.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Tipo de Trabalho</Label>
                 <Select value={formData.work_type} onValueChange={(v) => setFormData({ ...formData, work_type: v })}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {WORK_TYPES.map(t => (
                       <SelectItem key={t.value} value={t.value}>
                         {t.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="work_code">Código/Número</Label>
                 <Input
                   id="work_code"
                   value={formData.work_code}
                   onChange={(e) => setFormData({ ...formData, work_code: e.target.value })}
                   placeholder="Ex: OS-001"
                 />
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="start_date">Data de Início *</Label>
                 <Input
                   id="start_date"
                   type="date"
                   value={formData.start_date}
                   onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="end_date">Data de Finalização</Label>
                 <Input
                   id="end_date"
                   type="date"
                   value={formData.end_date}
                   onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                 />
               </div>
             </div>
             <div className="space-y-2">
               <Label>Status</Label>
               <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="in_progress">Em Andamento</SelectItem>
                   <SelectItem value="finished">Finalizado</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label htmlFor="notes">Observações</Label>
               <Textarea
                 id="notes"
                 value={formData.notes}
                 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                 placeholder="Observações sobre o trabalho..."
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