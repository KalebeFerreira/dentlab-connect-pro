import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { serviceFormSchema } from "@/lib/validationSchemas";

interface ServiceFormProps {
  onServiceAdd: () => Promise<void>;
}

export const ServiceForm = ({ onServiceAdd }: ServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleValueChange = (value: string) => {
    const formatted = formatCurrency(value);
    setServiceValue(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const numericValue = parseFloat(
        serviceValue.replace("R$", "").replace(/\./g, "").replace(",", ".")
      );

      // Validate input
      const validationResult = serviceFormSchema.safeParse({
        service_name: serviceName,
        service_value: numericValue,
        client_name: clientName || null,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast.error("Erro de validação", { description: errors });
        return;
      }

      const { error } = await supabase.from("services").insert([
        {
          user_id: user.id,
          service_name: serviceName.trim(),
          service_value: numericValue,
          client_name: clientName?.trim() || null,
          service_date: new Date().toISOString().split("T")[0],
          status: "active",
        },
      ]);

      if (error) throw error;

      toast.success("Serviço adicionado com sucesso!");
      setServiceName("");
      setServiceValue("");
      setClientName("");
      await onServiceAdd();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Serviço</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">Serviço Prestado</Label>
              <Input
                id="service_name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Descrição do serviço"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_value">Valor do Serviço</Label>
              <Input
                id="service_value"
                value={serviceValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="R$ 0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name">Nome do Cliente (Opcional)</Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Serviço
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
