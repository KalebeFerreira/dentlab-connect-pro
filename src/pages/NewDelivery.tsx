import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Calculator } from "lucide-react";

interface DeliveryPerson {
  id: string;
  name: string;
  vehicle_type: string;
}

const NewDelivery = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  
  const [formData, setFormData] = useState({
    delivery_person_id: "",
    pickup_address: "",
    delivery_address: "",
    cep: "",
    city: "",
    state: "",
    recipient_name: "",
    recipient_phone: "",
    notes: "",
    distance_km: "",
    delivery_fee: "",
    pickup_lat: undefined as number | undefined,
    pickup_lng: undefined as number | undefined,
    delivery_lat: undefined as number | undefined,
    delivery_lng: undefined as number | undefined,
  });
  const [loadingCep, setLoadingCep] = useState(false);

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
        .eq("is_active", true);

      if (error) throw error;
      setDeliveryPersons(data || []);
    } catch (error) {
      console.error("Error loading delivery persons:", error);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, "");
    
    if (cleanCep.length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      setFormData(prev => ({
        ...prev,
        city: data.localidade,
        state: data.uf,
      }));

      toast.success("Endereço preenchido automaticamente!");
    } catch (error) {
      console.error("Error fetching CEP:", error);
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    // Format CEP as user types (XXXXX-XXX)
    let formattedCep = value.replace(/\D/g, "");
    if (formattedCep.length > 5) {
      formattedCep = formattedCep.slice(0, 5) + "-" + formattedCep.slice(5, 8);
    }
    
    setFormData({ ...formData, cep: formattedCep });

    // Auto-fetch when CEP is complete
    if (formattedCep.replace(/\D/g, "").length === 8) {
      fetchAddressByCep(formattedCep);
    }
  };

  const calculateDeliveryFee = async () => {
    if (!formData.pickup_address || !formData.delivery_address || !formData.city || !formData.state) {
      toast.error("Preencha todos os campos de endereço (origem, destino, cidade e estado)");
      return;
    }

    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-delivery-fee", {
        body: {
          pickup_address: formData.pickup_address,
          delivery_address: formData.delivery_address,
          city: formData.city,
          state: formData.state,
        },
      });

      if (error) throw error;

      setFormData({
        ...formData,
        distance_km: data.distance_km.toFixed(2),
        delivery_fee: data.delivery_fee.toFixed(2),
        pickup_lat: data.pickup_lat,
        pickup_lng: data.pickup_lng,
        delivery_lat: data.delivery_lat,
        delivery_lng: data.delivery_lng,
      });

      toast.success("Taxa calculada com sucesso!");
    } catch (error) {
      console.error("Error calculating fee:", error);
      toast.error("Erro ao calcular taxa de entrega");
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.delivery_fee || !formData.distance_km) {
      toast.error("Calcule a taxa de entrega antes de continuar");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("deliveries").insert({
        user_id: user.id,
        delivery_person_id: formData.delivery_person_id || null,
        pickup_address: formData.pickup_address,
        pickup_lat: formData.pickup_lat,
        pickup_lng: formData.pickup_lng,
        delivery_address: formData.delivery_address,
        delivery_lat: formData.delivery_lat,
        delivery_lng: formData.delivery_lng,
        recipient_name: formData.recipient_name,
        recipient_phone: formData.recipient_phone,
        notes: formData.notes || null,
        distance_km: parseFloat(formData.distance_km),
        delivery_fee: parseFloat(formData.delivery_fee),
        status: "pending",
      });

      if (error) throw error;

      toast.success("Entrega criada com sucesso!");
      navigate("/deliveries");
    } catch (error) {
      console.error("Error creating delivery:", error);
      toast.error("Erro ao criar entrega");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/deliveries")}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nova Entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="delivery_person">Motoboy (Opcional)</Label>
                <Select
                  value={formData.delivery_person_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, delivery_person_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motoboy" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name} - {person.vehicle_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  disabled={loadingCep}
                />
                {loadingCep && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Buscando endereço...
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Cidade *</Label>
                  <Input
                    id="city"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Ex: Brasília"
                  />
                </div>

                <div>
                  <Label htmlFor="state">Estado *</Label>
                  <Input
                    id="state"
                    required
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder="Ex: DF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pickup_address">Endereço de Origem *</Label>
                <Textarea
                  id="pickup_address"
                  required
                  value={formData.pickup_address}
                  onChange={(e) =>
                    setFormData({ ...formData, pickup_address: e.target.value })
                  }
                  placeholder="Rua, número, bairro"
                />
              </div>

              <div>
                <Label htmlFor="delivery_address">Endereço de Destino *</Label>
                <Textarea
                  id="delivery_address"
                  required
                  value={formData.delivery_address}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_address: e.target.value })
                  }
                  placeholder="Rua, número, bairro"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="distance_km">Distância (km)</Label>
                  <Input
                    id="distance_km"
                    type="number"
                    step="0.01"
                    value={formData.distance_km}
                    readOnly
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="delivery_fee">Taxa de Entrega (R$)</Label>
                  <Input
                    id="delivery_fee"
                    type="number"
                    step="0.01"
                    value={formData.delivery_fee}
                    readOnly
                    placeholder="0.00"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={calculateDeliveryFee}
                disabled={calculating}
                variant="outline"
                className="w-full"
              >
                <Calculator className="w-4 h-4 mr-2" />
                {calculating ? "Calculando..." : "Calcular Taxa"}
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recipient_name">Nome do Destinatário *</Label>
                  <Input
                    id="recipient_name"
                    required
                    value={formData.recipient_name}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient_name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="recipient_phone">Telefone do Destinatário *</Label>
                  <Input
                    id="recipient_phone"
                    required
                    value={formData.recipient_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient_phone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Informações adicionais sobre a entrega"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/deliveries")}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Criando..." : "Criar Entrega"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewDelivery;