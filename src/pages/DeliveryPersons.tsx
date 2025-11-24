import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Truck, Star, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  license_plate: string | null;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
}

const DeliveryPersons = () => {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_type: "moto",
    license_plate: "",
  });

  useEffect(() => {
    loadDeliveryPersons();
  }, []);

  const loadDeliveryPersons = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("delivery_persons")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeliveryPersons(data || []);
    } catch (error) {
      console.error("Error loading delivery persons:", error);
      toast.error("Erro ao carregar motoboys");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("delivery_persons").insert({
        user_id: user.id,
        name: formData.name,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_plate: formData.license_plate || null,
      });

      if (error) throw error;

      toast.success("Motoboy cadastrado com sucesso!");
      setDialogOpen(false);
      setFormData({
        name: "",
        phone: "",
        vehicle_type: "moto",
        license_plate: "",
      });
      loadDeliveryPersons();
    } catch (error) {
      console.error("Error creating delivery person:", error);
      toast.error("Erro ao cadastrar motoboy");
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("delivery_persons")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success("Status atualizado!");
      loadDeliveryPersons();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Motoboys</h1>
          <p className="text-muted-foreground">Gerencie seus entregadores</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Motoboy
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Motoboy</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <Label htmlFor="vehicle_type">Tipo de Veículo *</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vehicle_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moto">Moto</SelectItem>
                    <SelectItem value="carro">Carro</SelectItem>
                    <SelectItem value="bicicleta">Bicicleta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="license_plate">Placa do Veículo</Label>
                <Input
                  id="license_plate"
                  value={formData.license_plate}
                  onChange={(e) =>
                    setFormData({ ...formData, license_plate: e.target.value })
                  }
                  placeholder="ABC-1234"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Cadastrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {deliveryPersons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum motoboy cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveryPersons.map((person) => (
            <Card key={person.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{person.name}</CardTitle>
                  <Badge variant={person.is_active ? "default" : "secondary"}>
                    {person.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{person.phone}</p>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="capitalize">{person.vehicle_type}</span>
                    {person.license_plate && (
                      <span className="text-muted-foreground">
                        ({person.license_plate})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>{person.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({person.total_deliveries} entregas)
                    </span>
                  </div>
                </div>

                <Button
                  variant={person.is_active ? "outline" : "default"}
                  className="w-full"
                  onClick={() => toggleActive(person.id, person.is_active)}
                >
                  {person.is_active ? "Desativar" : "Ativar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryPersons;