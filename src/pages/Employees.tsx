import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmployeeManagement } from "@/components/laboratory/EmployeeManagement";
import { Loader2 } from "lucide-react";

export default function Employees() {
  const { user } = useAuth();

  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['employees', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os funcionários do seu laboratório
        </p>
      </div>
      
      <EmployeeManagement 
        employees={employees} 
        onRefresh={refetch} 
      />
    </div>
  );
}
