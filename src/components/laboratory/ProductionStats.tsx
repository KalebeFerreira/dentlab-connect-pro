 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3, CheckCircle, Clock, TrendingUp, Users, DollarSign } from "lucide-react";
 import { format, startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import type { Employee } from "./EmployeeManagement";
 import type { WorkRecord } from "./WorkRecordManagement";
import { ProductionExport } from "./ProductionExport";
 
 interface ProductionStatsProps {
   employees: Employee[];
   workRecords: WorkRecord[];
   periodFilter: string;
   onPeriodChange: (period: string) => void;
  labName?: string;
 }
 
 const CHART_COLORS = [
   "hsl(var(--primary))",
   "hsl(var(--secondary))",
   "hsl(221, 83%, 53%)",
   "hsl(262, 83%, 58%)",
   "hsl(142, 71%, 45%)",
   "hsl(38, 92%, 50%)",
   "hsl(0, 84%, 60%)",
 ];
 
export const ProductionStats = ({ employees, workRecords, periodFilter, onPeriodChange, labName }: ProductionStatsProps) => {
   const stats = useMemo(() => {
     const now = new Date();
     let startDate: Date;
     let endDate: Date;
 
     if (periodFilter === "month") {
       startDate = startOfMonth(now);
       endDate = endOfMonth(now);
     } else {
       startDate = startOfYear(now);
       endDate = endOfYear(now);
     }
 
     const filteredRecords = workRecords.filter(record => {
       const recordDate = new Date(record.start_date);
       return isWithinInterval(recordDate, { start: startDate, end: endDate });
     });
 
     const finishedRecords = filteredRecords.filter(r => r.status === "finished");
     const inProgressRecords = filteredRecords.filter(r => r.status === "in_progress");
 
     // Production by employee
     const productionByEmployee = employees.map(emp => {
       const empRecords = filteredRecords.filter(r => r.employee_id === emp.id);
       const finished = empRecords.filter(r => r.status === "finished").length;
       const inProgress = empRecords.filter(r => r.status === "in_progress").length;
        const totalValue = empRecords.reduce((sum, r) => sum + (r.value || 0), 0);
       return {
         name: emp.name.split(" ")[0],
         fullName: emp.name,
         total: empRecords.length,
         finished,
         inProgress,
          totalValue,
          phone: emp.phone,
          email: emp.email,
       };
     }).filter(e => e.total > 0).sort((a, b) => b.total - a.total);

      const totalValue = filteredRecords.reduce((sum, r) => sum + (r.value || 0), 0);
 
     return {
       totalRecords: filteredRecords.length,
       finishedCount: finishedRecords.length,
       inProgressCount: inProgressRecords.length,
       productionByEmployee,
        totalValue,
       periodLabel: periodFilter === "month" 
         ? format(now, "MMMM 'de' yyyy", { locale: ptBR })
         : format(now, "yyyy", { locale: ptBR }),
     };
   }, [employees, workRecords, periodFilter]);
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <h3 className="text-lg font-semibold flex items-center gap-2">
           <BarChart3 className="h-5 w-5" />
           Relatórios de Produção
         </h3>
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <ProductionExport 
            employees={employees} 
            workRecords={workRecords} 
            periodFilter={periodFilter}
            labName={labName}
          />
        </div>
       </div>
 
       <p className="text-sm text-muted-foreground capitalize">
         Período: {stats.periodLabel}
       </p>
 
      <div className="grid gap-4 md:grid-cols-4">
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Total de Trabalhos</p>
                 <p className="text-3xl font-bold">{stats.totalRecords}</p>
               </div>
               <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                 <TrendingUp className="h-6 w-6 text-primary" />
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Finalizados</p>
                 <p className="text-3xl font-bold text-primary">{stats.finishedCount}</p>
               </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                 <p className="text-3xl font-bold text-secondary-foreground">{stats.inProgressCount}</p>
               </div>
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="h-6 w-6 text-secondary-foreground" />
               </div>
             </div>
           </CardContent>
         </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold text-primary">
                  {stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
       </div>
 
       {stats.productionByEmployee.length > 0 ? (
         <Card>
           <CardHeader>
             <CardTitle className="text-base flex items-center gap-2">
               <Users className="h-4 w-4" />
               Produção por Funcionário
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats.productionByEmployee} layout="vertical" margin={{ left: 20, right: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                   <XAxis type="number" allowDecimals={false} />
                   <YAxis type="category" dataKey="name" width={80} />
                   <Tooltip
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         const data = payload[0].payload;
                         return (
                           <div className="bg-background border rounded-lg p-3 shadow-lg">
                             <p className="font-medium">{data.fullName}</p>
                             <p className="text-sm text-muted-foreground">Total: {data.total}</p>
                             <p className="text-sm text-primary">Finalizados: {data.finished}</p>
                             <p className="text-sm text-muted-foreground">Em andamento: {data.inProgress}</p>
                            <p className="text-sm font-medium text-primary mt-1">
                              {data.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                           </div>
                         );
                       }
                       return null;
                     }}
                   />
                   <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                     {stats.productionByEmployee.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
       ) : (
         <Card>
           <CardContent className="py-12">
             <div className="text-center text-muted-foreground">
               <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>Nenhum trabalho registrado no período selecionado</p>
             </div>
           </CardContent>
         </Card>
       )}
     </div>
   );
 };