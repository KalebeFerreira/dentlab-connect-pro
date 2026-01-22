import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export const ClientAutocomplete = ({
  value,
  onChange,
  placeholder = "Nome da clínica",
  id,
}: ClientAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("services")
        .select("client_name")
        .eq("user_id", user.id)
        .not("client_name", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique client names
      const uniqueClients = [...new Set(
        data
          ?.map((s) => s.client_name)
          .filter((name): name is string => !!name)
      )].sort();

      setClients(uniqueClients);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            id={id}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (!open && e.target.value.length > 0) {
                setOpen(true);
              }
            }}
            onFocus={() => {
              if (clients.length > 0) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            className="pr-8"
          />
          <Building2 className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar cliente..."
            value={value}
            onValueChange={onChange}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhum cliente encontrado"}
            </CommandEmpty>
            <CommandGroup heading="Clientes cadastrados">
              {filteredClients.slice(0, 10).map((client) => (
                <CommandItem
                  key={client}
                  value={client}
                  onSelect={(selectedValue) => {
                    onChange(selectedValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.toLowerCase() === client.toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {client}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
