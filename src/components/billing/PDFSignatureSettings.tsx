import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PDFSignatureSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [companyInfoId, setCompanyInfoId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("company_info")
        .select("id, signature_position")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCompanyInfoId(data.id);
        setSignaturePosition((data.signature_position as "top" | "middle" | "bottom") || "bottom");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (companyInfoId) {
        // Update existing record
        const { error } = await supabase
          .from("company_info")
          .update({ signature_position: signaturePosition })
          .eq("id", companyInfoId);

        if (error) throw error;
      } else {
        // Create new record - user needs to fill company info first
        toast.error("Configure primeiro as informações da empresa na página de Faturamento");
        return;
      }

      toast.success("Configuração de assinatura salva com sucesso!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Posição da Assinatura nos PDFs
        </CardTitle>
        <CardDescription>
          Escolha onde a assinatura digital deve aparecer nos documentos PDF gerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={signaturePosition} onValueChange={(value: any) => setSignaturePosition(value)}>
          <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="top" id="top" />
            <Label htmlFor="top" className="flex-1 cursor-pointer">
              <div>
                <p className="font-medium">Topo do Documento</p>
                <p className="text-sm text-muted-foreground">A assinatura aparecerá no início do PDF, logo após o cabeçalho</p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="middle" id="middle" />
            <Label htmlFor="middle" className="flex-1 cursor-pointer">
              <div>
                <p className="font-medium">Meio do Documento</p>
                <p className="text-sm text-muted-foreground">A assinatura aparecerá no meio do conteúdo do PDF</p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="bottom" id="bottom" />
            <Label htmlFor="bottom" className="flex-1 cursor-pointer">
              <div>
                <p className="font-medium">Rodapé do Documento</p>
                <p className="text-sm text-muted-foreground">A assinatura aparecerá no final do PDF (recomendado)</p>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Esta configuração se aplica a todos os documentos com assinatura digital
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};