import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/SignaturePad";
import { orderFormSchema } from "@/lib/validationSchemas";
import { useFreemiumLimits } from "@/hooks/useFreemiumLimits";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { FreemiumBanner } from "@/components/FreemiumBanner";

interface Laboratory {
  id: string;
  lab_name: string;
  city: string | null;
  state: string | null;
  email: string;
  whatsapp: string;
}

const NewOrder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [workType, setWorkType] = useState("");
  const [customWorkType, setCustomWorkType] = useState("");
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState<string | null>(null);
  const limits = useFreemiumLimits();

  useEffect(() => {
    checkAuth();
    loadLaboratories();
    loadFavoriteLaboratory();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
    } catch (error) {
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadLaboratories = async () => {
    try {
      const { data, error } = await supabase
        .from("laboratory_info")
        .select("id, lab_name, city, state, email, whatsapp")
        .eq("is_public", true)
        .order("lab_name");

      if (error) throw error;
      setLaboratories(data || []);
    } catch (error) {
      console.error("Error loading laboratories:", error);
    }
  };

  const loadFavoriteLaboratory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("favorite_laboratory_id")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (profileData?.favorite_laboratory_id) {
        setSelectedLaboratoryId(profileData.favorite_laboratory_id);
      }
    } catch (error) {
      console.error("Error loading favorite laboratory:", error);
    }
  };

  const sendOrderToLaboratory = async (orderId: string, orderData: any, laboratory: Laboratory, userId: string) => {
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "Não definida";
      return new Date(dateStr).toLocaleDateString("pt-BR");
    };

    const formatCurrency = (value: number | null) => {
      if (!value) return "Não informado";
      return `R$ ${value.toFixed(2)}`;
    };

    const message = `📋 *NOVO PEDIDO - ${laboratory.lab_name}*

👤 *Paciente:* ${orderData.patient_name}
🏥 *Clínica:* ${orderData.clinic_name}
👨‍⚕️ *Dentista:* Dr(a). ${orderData.dentist_name}

🦷 *Tipo de Trabalho:* ${orderData.work_type.replace("_", " ")}
${orderData.work_name ? `📝 *Nome do Trabalho:* ${orderData.work_name}` : ""}
🔢 *Dentes:* ${orderData.teeth_numbers}
${orderData.custom_color ? `🎨 *Cor:* ${orderData.custom_color}` : ""}

💰 *Valor:* ${formatCurrency(orderData.amount)}
📅 *Data de Criação:* ${formatDate(new Date().toISOString())}
📦 *Previsão de Entrega:* ${formatDate(orderData.delivery_date)}

${orderData.observations ? `📌 *Observações:* ${orderData.observations}` : ""}

---
_Enviado automaticamente via DentLab Connect_`;

    // Save to message history
    try {
      await supabase.from("order_message_history").insert({
        order_id: orderId,
        user_id: userId,
        message_type: "whatsapp",
        message_content: message,
        recipient: laboratory.whatsapp,
      });
    } catch (error) {
      console.error("Error saving message history:", error);
    }

    // Open WhatsApp with the laboratory's number
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = laboratory.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check freemium limits - enforce for all users
    if (!limits.canCreateOrder) {
      toast.error("Limite de pedidos atingido", {
        description: limits.isSubscribed 
          ? "Você atingiu o limite mensal do seu plano atual." 
          : "Faça upgrade para criar mais pedidos."
      });
      if (!limits.isSubscribed) {
        setUpgradeDialogOpen(true);
      }
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      // Validate input
      const validationData = {
        clinic_name: formData.get('clinic_name') as string,
        dentist_name: formData.get('dentist_name') as string,
        patient_name: formData.get('patient_name') as string,
        work_name: (formData.get('work_name') as string) || null,
        work_type: workType === 'outro' ? customWorkType : workType,
        custom_color: (formData.get('custom_color') as string) || null,
        teeth_numbers: formData.get('teeth_numbers') as string,
        observations: (formData.get('observations') as string) || null,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : null,
        delivery_date: (formData.get('delivery_date') as string) || null,
      };

      const laboratoryId = selectedLaboratoryId || null;

      const validationResult = orderFormSchema.safeParse(validationData);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast.error("Erro de validação", { description: errors });
        setSubmitting(false);
        return;
      }

      // Upload signature if present
      let signatureUrl = null;
      if (signature) {
        const base64Data = signature.split(',')[1];
        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        const fileName = `signature_${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(`signatures/${fileName}`, blob);

        if (uploadError) throw uploadError;
        signatureUrl = uploadData.path;
      }
      
      const orderData = {
        user_id: user.id,
        clinic_name: validationData.clinic_name.trim(),
        dentist_name: validationData.dentist_name.trim(),
        patient_name: validationData.patient_name.trim(),
        work_name: validationData.work_name?.trim() || null,
        work_type: validationData.work_type.trim(),
        custom_color: validationData.custom_color?.trim() || null,
        teeth_numbers: validationData.teeth_numbers.trim(),
        observations: validationData.observations?.trim() || null,
        amount: validationData.amount,
        delivery_date: validationData.delivery_date,
        laboratory_id: laboratoryId,
        signature_url: signatureUrl,
        status: 'pending'
      };

      const { data: insertedOrder, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      // Send automatically to selected laboratory via WhatsApp
      if (laboratoryId && insertedOrder) {
        const selectedLab = laboratories.find(lab => lab.id === laboratoryId);
        if (selectedLab && selectedLab.whatsapp) {
          await sendOrderToLaboratory(insertedOrder.id, orderData, selectedLab, user.id);
          toast.success("Ordem criada e enviada!", {
            description: `O pedido foi enviado automaticamente para ${selectedLab.lab_name} via WhatsApp.`,
          });
        } else {
          toast.success("Ordem criada com sucesso!", {
            description: "A ordem de trabalho foi registrada no sistema.",
          });
        }
      } else {
        toast.success("Ordem criada com sucesso!", {
          description: "A ordem de trabalho foi registrada no sistema.",
        });
      }

      navigate('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error("Erro ao criar ordem", {
        description: "Não foi possível criar a ordem. Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nova Ordem de Trabalho</h1>
              <p className="text-sm text-muted-foreground">
                Preencha os dados da ordem de trabalho
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {!limits.loading && limits.orders && limits.orders.limit !== -1 && (
          <FreemiumBanner
            feature="pedidos por mês"
            currentUsage={limits.orders?.current || 0}
            limit={limits.orders?.limit || 10}
            percentage={limits.orders?.percentage || 0}
          />
        )}

        <form onSubmit={handleSubmit}>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Informações da Ordem</CardTitle>
              <CardDescription>
                Todos os campos marcados com * são obrigatórios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic_name">Nome da Clínica *</Label>
                  <Input
                    id="clinic_name"
                    name="clinic_name"
                    placeholder="Clínica Odontológica"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dentist_name">Nome do Dentista *</Label>
                  <Input
                    id="dentist_name"
                    name="dentist_name"
                    placeholder="Dr. João Silva"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_name">Nome do Paciente *</Label>
                <Input
                  id="patient_name"
                  name="patient_name"
                  placeholder="Nome completo do paciente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="laboratory_id">Laboratório</Label>
                <Select 
                  name="laboratory_id" 
                  value={selectedLaboratoryId || undefined}
                  onValueChange={(value) => setSelectedLaboratoryId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um laboratório (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {laboratories.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.lab_name}
                        {(lab.city || lab.state) && (
                          <span className="text-muted-foreground text-xs ml-2">
                            {lab.city && lab.state ? `${lab.city}, ${lab.state}` : lab.city || lab.state}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedLaboratoryId 
                    ? "✅ O pedido será enviado automaticamente via WhatsApp" 
                    : "Selecione um laboratório parceiro para envio automático"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_name">Nome do Trabalho *</Label>
                <Input
                  id="work_name"
                  name="work_name"
                  placeholder="Ex: Coroa unitária, Ponte fixa"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_type">Tipo de Trabalho *</Label>
                  <select
                    id="work_type"
                    name="work_type"
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="coroa">Coroa</option>
                    <option value="ponte">Ponte</option>
                    <option value="protocolo">Protocolo</option>
                    <option value="alinhador">Alinhador</option>
                    <option value="protese_parcial">Prótese Parcial</option>
                    <option value="protese_total">Prótese Total</option>
                    <option value="outro">Outro (digitar)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_color">Cor do Trabalho</Label>
                  <Input
                    id="custom_color"
                    name="custom_color"
                    placeholder="Ex: A1, A2, BL3, Personalizado"
                  />
                </div>
              </div>

              {workType === 'outro' && (
                <div className="space-y-2">
                  <Label htmlFor="custom_work_type">Digite o Tipo de Trabalho *</Label>
                  <Input
                    id="custom_work_type"
                    name="custom_work_type"
                    value={customWorkType}
                    onChange={(e) => setCustomWorkType(e.target.value)}
                    placeholder="Ex: Faceta, Onlay, Inlay, etc."
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teeth_numbers">Números dos Dentes *</Label>
                  <Input
                    id="teeth_numbers"
                    name="teeth_numbers"
                    placeholder="Ex: 11, 12, 13"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Data de Entrega Prevista</Label>
                  <Input
                    id="delivery_date"
                    name="delivery_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  name="observations"
                  placeholder="Adicione observações sobre o trabalho..."
                  rows={4}
                />
              </div>

              {/* Signature Pad */}
              <SignaturePad 
                onSignatureChange={setSignature}
                value={signature}
              />

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/orders")}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Criar Ordem
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <UpgradeDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          feature="pedidos por mês"
          currentUsage={limits.orders?.current || 0}
          limit={limits.orders?.limit || 10}
          percentage={limits.orders?.percentage || 0}
        />
      </main>
    </div>
  );
};

export default NewOrder;
