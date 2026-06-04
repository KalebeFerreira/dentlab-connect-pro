import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HideValuesToggleProps {
  hidden: boolean;
  onToggle: () => void;
  size?: "sm" | "default" | "icon";
  className?: string;
}

export const HideValuesToggle = ({ hidden, onToggle, size = "icon", className }: HideValuesToggleProps) => {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={onToggle}
      className={className}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
};
