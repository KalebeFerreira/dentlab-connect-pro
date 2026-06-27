import { useEffect, useState } from "react";
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
  const [confirmation, setConfirmation] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);

  const isProviderLoading = authProvider === null;
  const isPasswordAccount = authProvider === "email";
  const requiresTextConfirmation = authProvider !== null && !isPasswordAccount;

  useEffect(() => {
    if (!open) return;

    const loadProvider = async () => {
      const { data } = await supabase.auth.getUser();
      const provider = data.user?.app_metadata?.provider || data.user?.identities?.[0]?.provider || "email";
      setAuthProvider(provider);
    };

    loadProvider();
  }, [open]);

  const handlePasswordSubmit = () => {
    if (requiresTextConfirmation) {
      setConfirmStep(true);
      return;
    }

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
        body: {
          password: isPasswordAccount ? password : undefined,
          confirmation: requiresTextConfirmation ? confirmation : undefined,
        },
      });

      if (error) {
        // Try to surface the function's JSON error body
        let errorMsg = error.message || "Erro ao excluir conta";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.body) {
            const body = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
            if (body?.error) errorMsg = body.error;
          }
        } catch {}
        console.error("delete-account error:", error);
        toast.error(errorMsg);
        setDeleting(false);
        return;
      }

      if (data?.error) {
        console.error("delete-account data error:", data);
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
      setConfirmation("");
      setConfirmStep(false);
      setDeleting(false);
      setAuthProvider(null);
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
              : isProviderLoading
                ? "Carregando o método de acesso da sua conta."
                : requiresTextConfirmation
                ? "Para excluir sua conta conectada pelo Google, avance e confirme digitando EXCLUIR."
                : "Para excluir sua conta, digite sua senha para confirmar sua identidade."}
          </DialogDescription>
        </DialogHeader>

        {isProviderLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando conta...
          </div>
        ) : !confirmStep && isPasswordAccount ? (
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
        ) : !confirmStep ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium mb-1">Conta conectada por Google</p>
            <p>Na próxima etapa, confirme a exclusão digitando EXCLUIR.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium mb-1">⚠️ Atenção!</p>
              <p>Esta ação não pode ser desfeita. Todos os seus dados serão apagados permanentemente.</p>
            </div>
            {requiresTextConfirmation && (
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">Digite EXCLUIR para confirmar</Label>
                <Input
                  id="delete-confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="EXCLUIR"
                  onKeyDown={(e) => e.key === "Enter" && confirmation.trim().toUpperCase() === "EXCLUIR" && handleDeleteAccount()}
                />
              </div>
            )}
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
              disabled={isProviderLoading || (isPasswordAccount && !password)}
            >
              Continuar
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting || (requiresTextConfirmation && confirmation.trim().toUpperCase() !== "EXCLUIR")}
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
