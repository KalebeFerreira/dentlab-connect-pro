import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

interface Delivery {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_lat: number;
  delivery_lng: number;
  status: string;
  delivery_person_id: string | null;
  distance_km: number | null;
}

interface OptimizationResult {
  motoboy: DeliveryPerson;
  deliveries: Delivery[];
  totalDistance: number;
  count: number;
}

export function DeliveryOptimizer() {
  const [loading, setLoading] = useState(false);
  const [optimizations, setOptimizations] = useState<OptimizationResult[]>([]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const optimizeDeliveries = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get active motoboys
      const { data: motoboys, error: motoboyError } = await supabase
        .from("delivery_persons")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (motoboyError) throw motoboyError;

      // Get pending deliveries
      const { data: deliveries, error: deliveriesError } = await supabase
        .from("deliveries")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (deliveriesError) throw deliveriesError;

      if (!motoboys || motoboys.length === 0) {
        toast.error("Nenhum motoboy ativo encontrado");
        return;
      }

      if (!deliveries || deliveries.length === 0) {
        toast.info("Nenhuma entrega pendente para otimizar");
        return;
      }

      // Simple optimization: group deliveries by proximity
      const results: OptimizationResult[] = [];

      for (const motoboy of motoboys) {
        // Get current deliveries for this motoboy
        const motoboyDeliveries = deliveries.filter(d => d.delivery_person_id === motoboy.id);
        
        if (motoboyDeliveries.length > 0) {
          const totalDistance = motoboyDeliveries.reduce((sum, d) => sum + (d.distance_km || 0), 0);
          results.push({
            motoboy,
            deliveries: motoboyDeliveries,
            totalDistance,
            count: motoboyDeliveries.length,
          });
        }
      }

      // Find unassigned deliveries and suggest optimal motoboy
      const unassigned = deliveries.filter(d => !d.delivery_person_id);
      
      if (unassigned.length > 0 && motoboys.length > 0) {
        toast.info(`${unassigned.length} entregas não atribuídas. Clique em "Atribuir Automaticamente" para otimizar.`);
      }

      setOptimizations(results);
      toast.success("Otimização calculada com sucesso!");
    } catch (error) {
      console.error("Error optimizing:", error);
      toast.error("Erro ao otimizar entregas");
    } finally {
      setLoading(false);
    }
  };

  const autoAssignDeliveries = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: motoboys } = await supabase
        .from("delivery_persons")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const { data: unassigned } = await supabase
        .from("deliveries")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .is("delivery_person_id", null);

      if (!motoboys || motoboys.length === 0 || !unassigned || unassigned.length === 0) {
        toast.error("Não há motoboys ou entregas disponíveis");
        return;
      }

      // Assign deliveries to motoboys evenly
      let motoboyIndex = 0;
      for (const delivery of unassigned) {
        const assignedMotoboy = motoboys[motoboyIndex];
        
        await supabase
          .from("deliveries")
          .update({ delivery_person_id: assignedMotoboy.id })
          .eq("id", delivery.id);

        motoboyIndex = (motoboyIndex + 1) % motoboys.length;
      }

      toast.success(`${unassigned.length} entregas atribuídas automaticamente!`);
      optimizeDeliveries();
    } catch (error) {
      console.error("Error auto-assigning:", error);
      toast.error("Erro ao atribuir entregas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    optimizeDeliveries();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Otimização de Entregas</h2>
        <div className="flex gap-2">
          <Button onClick={autoAssignDeliveries} disabled={loading}>
            <Users className="mr-2 h-4 w-4" />
            Atribuir Automaticamente
          </Button>
          <Button onClick={optimizeDeliveries} disabled={loading} variant="outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Recalcular
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {optimizations.map((opt) => (
          <Card key={opt.motoboy.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{opt.motoboy.name}</span>
                <Badge variant="default">{opt.count} entregas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="mr-2 h-4 w-4" />
                  <span>Distância total: {opt.totalDistance.toFixed(2)} km</span>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Entregas:</p>
                  <ul className="list-disc list-inside mt-1">
                    {opt.deliveries.slice(0, 3).map((d) => (
                      <li key={d.id} className="truncate text-muted-foreground">
                        {d.delivery_address}
                      </li>
                    ))}
                    {opt.deliveries.length > 3 && (
                      <li className="text-muted-foreground">
                        +{opt.deliveries.length - 3} mais...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {optimizations.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Nenhuma entrega atribuída ainda. Use "Atribuir Automaticamente" para começar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
