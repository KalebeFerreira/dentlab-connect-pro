import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const CertificateGenerator = () => {
  const [loading, setLoading] = useState(false);
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

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
          issueDate: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
        },
      });

      if (error) throw error;

      // Download PDF
      const blob = await fetch(data.pdfUrl).then(r => r.blob());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atestado-${formData.patientName.replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Atestado gerado com sucesso!");
      
      // Reset form
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

          <div>
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Informações adicionais (opcional)"
              rows={3}
            />
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