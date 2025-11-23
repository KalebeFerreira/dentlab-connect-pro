import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Crown, TrendingUp, Zap } from "lucide-react";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentUsage: number;
  limit: number;
  percentage: number;
}

export const UpgradeDialog = ({
  open,
  onOpenChange,
  feature,
  currentUsage,
  limit,
  percentage,
}: UpgradeDialogProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/planos');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Crown className="h-8 w-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Limite do Plano Gratuito Atingido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-4">
            <p>
              Você atingiu o limite de <strong>{limit} {feature}</strong> do plano gratuito.
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uso atual:</span>
                <span className="font-semibold">{currentUsage} / {limit}</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-left">
              <p className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Faça upgrade e desbloqueie:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Pedidos ilimitados</strong> por mês</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Clientes ilimitados</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Imagens IA ilimitadas</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>PDFs ilimitados</strong> por mês</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Relatórios completos com envio automático</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Suporte prioritário</span>
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Continuar no Gratuito
          </Button>
          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            <Crown className="h-4 w-4 mr-2" />
            Ver Planos
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
