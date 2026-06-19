import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wallet, CalendarClock, HelpCircle, Search } from "lucide-react";

type PaymentType = "a_vista" | "mensalista" | "nao_definido";

interface ProfileRow {
  client_name: string;
  payment_type: PaymentType;
}

const TYPE_LABEL: Record<PaymentType, string> = {
  a_vista: "À vista",
  mensalista: "Mensalista",
  nao_definido: "Não definido",
};

export function ClientPaymentCategories() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PaymentType>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const [{ data: services }, { data: profilesData }] = await Promise.all([
          supabase
            .from("services")
            .select("client_name")
            .eq("user_id", user.id)
            .eq("status", "active")
            .not("client_name", "is", null),
          supabase
            .from("client_payment_profiles")
            .select("client_name, payment_type")
            .eq("user_id", user.id),
        ]);

        const names = Array.from(
          new Set(
            (services || [])
              .map((s: any) => (s.client_name || "").trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));

        const profMap: Record<string, PaymentType> = {};
        (profilesData as ProfileRow[] | null)?.forEach((p) => {
          profMap[p.client_name] = p.payment_type;
        });
        // Include orphan profile entries (clients without active services)
        (profilesData as ProfileRow[] | null)?.forEach((p) => {
          if (!names.includes(p.client_name)) names.push(p.client_name);
        });

        setClients(names);
        setProfiles(profMap);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar clientes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setClientType = async (clientName: string, type: PaymentType) => {
    if (!userId) return;
    const prev = profiles[clientName];
    setProfiles((p) => ({ ...p, [clientName]: type }));
    const { error } = await supabase
      .from("client_payment_profiles")
      .upsert(
        { user_id: userId, client_name: clientName, payment_type: type },
        { onConflict: "user_id,client_name" }
      );
    if (error) {
      setProfiles((p) => ({ ...p, [clientName]: prev ?? "nao_definido" }));
      toast.error("Não foi possível salvar");
      console.error(error);
    } else {
      toast.success(`${clientName}: ${TYPE_LABEL[type]}`);
    }
  };

  const filtered = useMemo(
    () => clients.filter((c) => c.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  const counts = useMemo(() => {
    let aVista = 0, mensal = 0, indef = 0;
    clients.forEach((c) => {
      const t = profiles[c] ?? "nao_definido";
      if (t === "a_vista") aVista++;
      else if (t === "mensalista") mensal++;
      else indef++;
    });
    return { aVista, mensal, indef };
  }, [clients, profiles]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">À vista</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{counts.aVista}</div>
            <p className="text-xs text-muted-foreground">clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mensalistas</CardTitle>
            <CalendarClock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{counts.mensal}</div>
            <p className="text-xs text-muted-foreground">clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sem classificação</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.indef}</div>
            <p className="text-xs text-muted-foreground">clientes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Classificação de clientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marque cada cliente como <strong>À vista</strong> ou <strong>Mensalista</strong>. É apenas para seu controle — não altera lançamentos financeiros.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {clients.length === 0
                ? "Nenhum cliente encontrado. Cadastre serviços para começar."
                : "Nenhum cliente corresponde à busca."}
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {filtered.map((name) => {
                const type = profiles[name] ?? "nao_definido";
                return (
                  <div
                    key={name}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{name}</span>
                      {type === "a_vista" && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">À vista</Badge>
                      )}
                      {type === "mensalista" && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Mensalista</Badge>
                      )}
                    </div>
                    <Select
                      value={type}
                      onValueChange={(v) => setClientType(name, v as PaymentType)}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_definido">Não definido</SelectItem>
                        <SelectItem value="a_vista">À vista</SelectItem>
                        <SelectItem value="mensalista">Mensalista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ClientPaymentCategories;
