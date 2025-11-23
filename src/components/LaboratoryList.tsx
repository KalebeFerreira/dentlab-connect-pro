import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Laboratory {
  id: string;
  lab_name: string;
  email: string;
  whatsapp: string;
  address: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  logo_url: string | null;
  is_public: boolean;
}

export const LaboratoryList = () => {
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLaboratories();
  }, []);

  const loadLaboratories = async () => {
    try {
      const { data, error } = await supabase
        .from("laboratory_info")
        .select("*")
        .eq("is_public", true)
        .order("lab_name");

      if (error) throw error;
      setLaboratories(data || []);
    } catch (error: any) {
      console.error("Error loading laboratories:", error);
      toast.error("Erro ao carregar laboratórios");
    } finally {
      setLoading(false);
    }
  };

  const handleContactWhatsApp = (whatsapp: string, labName: string) => {
    const message = `Olá! Gostaria de saber mais sobre os serviços do ${labName}.`;
    const url = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (laboratories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Laboratórios Disponíveis</CardTitle>
          <CardDescription>
            Nenhum laboratório disponível no momento
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Laboratórios Disponíveis</h2>
        <p className="text-muted-foreground">
          Escolha um laboratório para realizar seus serviços protéticos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {laboratories.map((lab) => (
          <Card key={lab.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {lab.logo_url && (
                    <img
                      src={lab.logo_url}
                      alt={lab.lab_name}
                      className="h-12 w-auto object-contain mb-3"
                    />
                  )}
                  <CardTitle className="text-lg">{lab.lab_name}</CardTitle>
                </div>
                <Badge variant="secondary">Ativo</Badge>
              </div>
              {lab.description && (
                <CardDescription className="mt-2">
                  {lab.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="break-all">{lab.email}</span>
                </div>
                
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{lab.whatsapp}</span>
                </div>

                {(lab.address || lab.city || lab.state) && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {[lab.address, lab.city, lab.state]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleContactWhatsApp(lab.whatsapp, lab.lab_name)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Contatar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(`mailto:${lab.email}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
