import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

export const DeleteAccountDialog = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePasswordSubmit = () => {
    if (!password || password.trim().length === 0) {
      toast.error("Digite sua senha para continuar");
      return;
    }
    setConfirmStep(true);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { password },
      });

      if (error) {
        const errorMsg = error.message || "Erro ao excluir conta";
        toast.error(errorMsg);
        setDeleting(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setDeleting(false);
        return;
      }

      toast.success("Conta excluída com sucesso");
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: any) {
      console.error("Error deleting account:", err);
      toast.error("Erro ao excluir conta. Tente novamente.");
      setDeleting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPassword("");
      setConfirmStep(false);
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
          Excluir Conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {confirmStep ? "Confirmar Exclusão" : "Excluir Conta Permanentemente"}
          </DialogTitle>
          <DialogDescription>
            {confirmStep
              ? "Tem certeza absoluta? Esta ação é irreversível. Todos os seus dados, pedidos, pacientes e informações serão permanentemente excluídos."
              : "Para excluir sua conta, digite sua senha para confirmar sua identidade."}
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Senha</Label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
            </div>
          </div>
        ) : (
          <div className="py-2">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium mb-1">⚠️ Atenção!</p>
              <p>Esta ação não pode ser desfeita. Todos os seus dados serão apagados permanentemente.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          {!confirmStep ? (
            <Button
              variant="destructive"
              onClick={handlePasswordSubmit}
              disabled={!password}
            >
              Continuar
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, Excluir Minha Conta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
