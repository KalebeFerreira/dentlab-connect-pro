import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Loader2, Star } from "lucide-react";

interface Laboratory {
  id: string;
  lab_name: string;
  city: string | null;
  state: string | null;
}

export const FavoriteLaboratorySettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load laboratories
      const { data: labData, error: labError } = await supabase
        .from("laboratory_info")
        .select("id, lab_name, city, state")
        .eq("is_public", true)
        .order("lab_name");

      if (labError) throw labError;
      setLaboratories(labData || []);

      // Load user's favorite laboratory
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("favorite_laboratory_id")
        .eq("user_id", user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      
      if (profileData?.favorite_laboratory_id) {
        setSelectedLabId(profileData.favorite_laboratory_id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({ favorite_laboratory_id: selectedLabId })
        .eq("user_id", user.id);

      if (error) throw error;

      const selectedLab = laboratories.find(lab => lab.id === selectedLabId);
      toast.success("Laboratório favorito salvo!", {
        description: selectedLab 
          ? `${selectedLab.lab_name} será selecionado automaticamente em novos pedidos.`
          : "Preferência removida com sucesso."
      });
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar", {
        description: "Não foi possível salvar o laboratório favorito."
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSelectedLabId(null);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({ favorite_laboratory_id: null })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Preferência removida!", {
        description: "Você precisará selecionar um laboratório manualmente em novos pedidos."
      });
    } catch (error) {
      console.error("Error clearing:", error);
      toast.error("Erro ao remover preferência");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const selectedLab = laboratories.find(lab => lab.id === selectedLabId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Laboratório Favorito
        </CardTitle>
        <CardDescription>
          Configure um laboratório padrão para novos pedidos. O pedido será enviado automaticamente via WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {laboratories.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p>Nenhum laboratório disponível.</p>
            <p className="text-sm">Laboratórios públicos aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="favorite_lab">Laboratório Padrão</Label>
              <Select
                value={selectedLabId || undefined}
                onValueChange={(value) => setSelectedLabId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um laboratório favorito" />
                </SelectTrigger>
                <SelectContent>
                  {laboratories.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      <div className="flex items-center gap-2">
                        {lab.lab_name}
                        {(lab.city || lab.state) && (
                          <span className="text-muted-foreground text-xs">
                            ({lab.city && lab.state ? `${lab.city}, ${lab.state}` : lab.city || lab.state})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLab && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span className="text-sm">
                  <strong>{selectedLab.lab_name}</strong> será selecionado automaticamente em novos pedidos
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Preferência
              </Button>
              {selectedLabId && (
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={saving}
                >
                  Limpar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
