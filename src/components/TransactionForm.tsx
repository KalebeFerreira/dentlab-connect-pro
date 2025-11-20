import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";
import { transactionFormSchema } from "@/lib/validationSchemas";

interface TransactionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editTransaction?: {
    id: string;
    transaction_type: string;
    amount: number;
    description: string;
    status: string;
    month: number;
    year: number;
  } | null;
}

export const TransactionForm = ({ onSuccess, onCancel, editTransaction }: TransactionFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: editTransaction?.transaction_type || "receipt",
    amount: editTransaction?.amount || "",
    description: editTransaction?.description || "",
    status: editTransaction?.status || "completed",
    month: editTransaction?.month || new Date().getMonth() + 1,
    year: editTransaction?.year || new Date().getFullYear(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validate input
      const validationResult = transactionFormSchema.safeParse({
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount.toString()),
        description: formData.description || null,
        status: formData.status,
        month: formData.month,
        year: formData.year,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast.error("Erro de validação", { description: errors });
        setLoading(false);
        return;
      }

      const transactionData = {
        user_id: user.id,
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount.toString()),
        description: formData.description?.trim() || null,
        status: formData.status,
        month: formData.month,
        year: formData.year,
      };

      if (editTransaction) {
        const { error } = await supabase
          .from("financial_transactions")
          .update(transactionData)
          .eq("id", editTransaction.id);

        if (error) throw error;
        toast.success("Transação atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("financial_transactions")
          .insert(transactionData);

        if (error) throw error;
        toast.success("Transação criada com sucesso!");
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast.error("Erro ao salvar transação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {editTransaction ? "Editar Transação" : "Nova Transação"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="transaction_type">Tipo</Label>
            <Select
              value={formData.transaction_type}
              onValueChange={(value) =>
                setFormData({ ...formData, transaction_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">Receita</SelectItem>
                <SelectItem value="payment">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0,00"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descreva a transação"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">Mês</Label>
              <Select
                value={formData.month.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, month: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(12)].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {new Date(2000, i).toLocaleString("pt-BR", {
                        month: "long",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="year">Ano</Label>
              <Input
                id="year"
                type="number"
                min="2020"
                max="2100"
                required
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Confirmado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading
                ? "Salvando..."
                : editTransaction
                ? "Atualizar"
                : "Criar Transação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
