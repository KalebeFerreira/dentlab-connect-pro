import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Users, Calendar, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: "order" | "patient" | "appointment";
  title: string;
  subtitle: string;
  date?: string;
}

interface QuickSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickSearch = ({ open, onOpenChange }: QuickSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const searchTerm = `%${query}%`;
      const results: SearchResult[] = [];

      // Search orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, os_number, patient_name, work_type, created_at, status")
        .eq("user_id", user.id)
        .or(`patient_name.ilike.${searchTerm},work_type.ilike.${searchTerm},os_number.ilike.${searchTerm}`)
        .limit(5);

      if (orders) {
        orders.forEach((order) => {
          results.push({
            id: order.id,
            type: "order",
            title: `${order.os_number || "Pedido"} - ${order.patient_name}`,
            subtitle: order.work_type,
            date: new Date(order.created_at).toLocaleDateString("pt-BR"),
          });
        });
      }

      // Search patients
      const { data: patients } = await supabase
        .from("patients")
        .select("id, name, phone, email")
        .eq("user_id", user.id)
        .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5);

      if (patients) {
        patients.forEach((patient) => {
          results.push({
            id: patient.id,
            type: "patient",
            title: patient.name,
            subtitle: patient.phone,
          });
        });
      }

      // Search appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, appointment_date, type, notes, patients(name)")
        .eq("user_id", user.id)
        .or(`type.ilike.${searchTerm},notes.ilike.${searchTerm}`)
        .limit(5);

      if (appointments) {
        appointments.forEach((appointment: any) => {
          results.push({
            id: appointment.id,
            type: "appointment",
            title: `${appointment.patients?.name || "Paciente"} - ${appointment.type}`,
            subtitle: new Date(appointment.appointment_date).toLocaleString("pt-BR"),
            date: new Date(appointment.appointment_date).toLocaleDateString("pt-BR"),
          });
        });
      }

      setResults(results);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onOpenChange(false);
    switch (result.type) {
      case "order":
        navigate(`/orders/${result.id}`);
        break;
      case "patient":
        navigate("/patients");
        break;
      case "appointment":
        navigate("/appointments");
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <FileText className="h-4 w-4" />;
      case "patient":
        return <Users className="h-4 w-4" />;
      case "appointment":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const config = {
      order: { label: "Pedido", variant: "default" as const },
      patient: { label: "Paciente", variant: "secondary" as const },
      appointment: { label: "Agendamento", variant: "outline" as const },
    };
    return config[type as keyof typeof config] || config.order;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="sr-only">Busca Rápida</DialogTitle>
          <div className="flex items-center gap-2 pb-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pedidos, pacientes ou agendamentos..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="p-4">
            {query.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Digite ao menos 2 caracteres para buscar
              </p>
            )}

            {query.length >= 2 && loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Buscando...
              </p>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum resultado encontrado
              </p>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((result) => {
                  const badge = getTypeBadge(result.type);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                          {result.date && (
                            <span className="text-xs text-muted-foreground">
                              {result.date}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
