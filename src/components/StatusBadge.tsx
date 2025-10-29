import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2, Package } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="destructive" className="bg-[hsl(var(--status-pending))]">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'in_production':
      return (
        <Badge className="bg-[hsl(var(--status-production))] text-white hover:bg-[hsl(var(--status-production))]">
          <Loader2 className="w-3 h-3 mr-1" />
          Em Produção
        </Badge>
      );
    case 'completed':
      return (
        <Badge className="bg-[hsl(var(--status-completed))] hover:bg-[hsl(var(--status-completed))]">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Finalizado
        </Badge>
      );
    case 'delivered':
      return (
        <Badge className="bg-primary hover:bg-primary">
          <Package className="w-3 h-3 mr-1" />
          Entregue
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};
