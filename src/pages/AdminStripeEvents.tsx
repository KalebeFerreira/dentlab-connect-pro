import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

interface StripeEvent {
  id: string;
  stripe_event_id: string;
  type: string;
  status: string;
  livemode: boolean;
  error: string | null;
  payload: any;
  stripe_created_at: string;
  created_at: string;
}

export default function AdminStripeEvents() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<StripeEvent | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stripe_event_logs" as any)
      .select("*")
      .order("stripe_created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setEvents((data as any) || []);
    setLoading(false);
  };

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-stripe-events");
    setSyncing(false);
    if (error) {
      toast.error("Erro na sincronização: " + error.message);
      return;
    }
    toast.success(`Sincronizado: ${data?.inserted || 0} eventos`);
    load();
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (roleLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) return <div className="p-8">Acesso restrito a administradores.</div>;

  const filtered = events.filter((e) =>
    !filter || e.type.toLowerCase().includes(filter.toLowerCase()) || e.stripe_event_id.includes(filter)
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Eventos Stripe</h1>
        <Button onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico (últimos 200)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por tipo ou ID..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={load}>Atualizar</Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Stripe</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(e.stripe_created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.type}</TableCell>
                    <TableCell>
                      <Badge variant={e.error ? "destructive" : "default"}>
                        {e.error ? "erro" : e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.livemode ? "default" : "secondary"}>
                        {e.livemode ? "live" : "test"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[180px]">
                      {e.stripe_event_id}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>Ver</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum evento. Clique em "Sincronizar agora".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selected?.type}</DialogTitle>
          </DialogHeader>
          {selected?.error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
              <strong>Erro:</strong> {selected.error}
            </div>
          )}
          <pre className="bg-muted p-3 rounded text-xs overflow-auto">
            {JSON.stringify(selected?.payload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
