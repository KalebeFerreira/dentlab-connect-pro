import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HideValuesToggleProps {
  hidden: boolean;
  onToggle: () => void;
  size?: "sm" | "default" | "icon";
  className?: string;
  /** When true, always show only the icon (no label) regardless of viewport. */
  iconOnly?: boolean;
}

export const HideValuesToggle = ({
  hidden,
  onToggle,
  size = "sm",
  className,
  iconOnly = false,
}: HideValuesToggleProps) => {
  const label = hidden ? "Mostrar valores" : "Ocultar valores";
  const showLabel = !iconOnly && size !== "icon";
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : size}
      onClick={onToggle}
      className={className}
      title={label}
      aria-label={label}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {!iconOnly && <span className="ml-2 hidden sm:inline">{label}</span>}
    </Button>
  );
};
