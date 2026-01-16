import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SignatureCanvas from "react-signature-canvas";
import { generatePDF, createElementFromHTML, cleanupElement } from "@/lib/pdfGenerator";

interface CertificateTemplate {
  id: string;
  template_name: string;
  category: string;
  default_reason: string;
  default_days: number;
  default_text: string;
}

export const CertificateGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [signatureUrl, setSignatureUrl] = useState<string>("");
  const [formData, setFormData] = useState({
    patientName: "",
    patientCpf: "",
    dentistName: "",
    dentistCro: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    days: "1",
    reason: "",
    observations: "",
    customText: "",
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("category, template_name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        reason: template.default_reason,
        days: template.default_days.toString(),
        customText: template.default_text,
      });
    }
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
    setSignatureUrl("");
  };

  const saveSignature = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast.error("Por favor, desenhe sua assinatura primeiro");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const signatureDataUrl = signaturePadRef.current.toDataURL();
      const blob = await fetch(signatureDataUrl).then(r => r.blob());
      const fileName = `signature-${Date.now()}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("laboratory-files")
        .upload(`signatures/${user.id}/${fileName}`, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("laboratory-files")
        .getPublicUrl(`signatures/${user.id}/${fileName}`);

      setSignatureUrl(urlData.publicUrl);
      toast.success("Assinatura salva com sucesso!");
    } catch (error) {
      console.error("Error saving signature:", error);
      toast.error("Erro ao salvar assinatura");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signatureUrl && (signaturePadRef.current && signaturePadRef.current.isEmpty())) {
      toast.error("Por favor, adicione sua assinatura antes de gerar o atestado");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Use existing signature URL or the saved one
      const finalSignatureUrl = signatureUrl;

      const { data, error } = await supabase.functions.invoke("generate-certificate-pdf", {
        body: {
          patientName: formData.patientName,
          patientCpf: formData.patientCpf,
          dentistName: formData.dentistName,
          dentistCro: formData.dentistCro,
          startDate: formData.startDate,
          endDate: formData.endDate,
          days: formData.days,
          reason: formData.reason,
          observations: formData.observations,
          customText: formData.customText,
          signatureUrl: finalSignatureUrl,
          issueDate: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
        },
      });

      if (error) throw error;

      // Convert HTML to PDF using secure jsPDF + html2canvas
      const element = createElementFromHTML(data.html);
      
      try {
        await generatePDF(element, {
          filename: `atestado-${formData.patientName.replace(/\s+/g, "-")}.pdf`,
          margin: 25,
          format: "a4",
          orientation: "portrait",
          scale: 2,
        });
      } finally {
        cleanupElement(element);
      }

      toast.success("Atestado gerado com sucesso!");
      
      // Reset form
      setSelectedTemplate("");
      setSignatureUrl("");
      signaturePadRef.current?.clear();
      setFormData({
        patientName: "",
        patientCpf: "",
        dentistName: "",
        dentistCro: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        days: "1",
        reason: "",
        observations: "",
        customText: "",
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast.error("Erro ao gerar atestado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <div>
            <CardTitle>Gerador de Atestados</CardTitle>
            <CardDescription>
              Gere atestados odontológicos para seus pacientes
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div>
              <Label htmlFor="template">Selecionar Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template ou preencha manualmente" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name} - {template.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="patientName">Nome do Paciente *</Label>
              <Input
                id="patientName"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="patientCpf">CPF do Paciente</Label>
              <Input
                id="patientCpf"
                value={formData.patientCpf}
                onChange={(e) => setFormData({ ...formData, patientCpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="dentistName">Nome do Dentista *</Label>
              <Input
                id="dentistName"
                value={formData.dentistName}
                onChange={(e) => setFormData({ ...formData, dentistName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="dentistCro">CRO *</Label>
              <Input
                id="dentistCro"
                value={formData.dentistCro}
                onChange={(e) => setFormData({ ...formData, dentistCro: e.target.value })}
                required
                placeholder="SP 12345"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="startDate">Data Início *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Fim *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="days">Dias de Afastamento *</Label>
              <Input
                id="days"
                type="number"
                min="1"
                value={formData.days}
                onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Motivo do Atestado *</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Tratamento odontológico"
              required
            />
          </div>

          {formData.customText && (
            <div>
              <Label htmlFor="customText">Texto Personalizado</Label>
              <Textarea
                id="customText"
                value={formData.customText}
                onChange={(e) => setFormData({ ...formData, customText: e.target.value })}
                rows={4}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {"{patientName}"}, {"{days}"}, {"{startDate}"}, {"{endDate}"}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="observations">Observações Adicionais</Label>
            <Textarea
              id="observations"
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Informações adicionais (opcional)"
              rows={3}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Assinatura Digital *</Label>
              <div className="flex gap-2">
                {!signatureUrl && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={saveSignature}
                    className="gap-2"
                  >
                    Salvar Assinatura
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>
            <div className="border-2 border-dashed rounded-lg p-4 bg-muted/50">
              {signatureUrl ? (
                <div className="text-center">
                  <img 
                    src={signatureUrl} 
                    alt="Assinatura" 
                    className="max-h-32 mx-auto border rounded bg-white p-2"
                  />
                  <p className="text-xs text-green-600 font-medium mt-2">
                    ✓ Assinatura salva e pronta para uso
                  </p>
                </div>
              ) : (
                <>
                  <SignatureCanvas
                    ref={signaturePadRef}
                    canvasProps={{
                      className: "signature-canvas w-full h-32 bg-background rounded border",
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Assine acima e clique em "Salvar Assinatura"
                  </p>
                </>
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? (
              "Gerando..."
            ) : (
              <>
                <Download className="h-4 w-4" />
                Gerar Atestado PDF
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};