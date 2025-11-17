import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, User, Calendar, FileText, Download } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";
import { toast } from "sonner";

interface Order {
  id: string;
  clinic_name: string;
  dentist_name: string;
  patient_name: string;
  work_name: string | null;
  work_type: string;
  custom_color: string | null;
  amount: number | null;
  status: string;
  teeth_numbers: string;
  observations: string | null;
  created_at: string;
  delivery_date: string | null;
}

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [refreshFiles, setRefreshFiles] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadOrder();
  }, [id]);

  const checkAuthAndLoadOrder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      if (!id) {
        navigate("/orders");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setOrder(data);

      // Load signature if exists
      if (data.signature_url) {
        const { data: publicUrlData } = supabase.storage
          .from('order-files')
          .getPublicUrl(data.signature_url);
        
        if (publicUrlData) {
          setSignatureUrl(publicUrlData.publicUrl);
        }
      }
    } catch (error) {
      console.error("Error loading order:", error);
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setGeneratingPdf(true);
      
      const { data, error } = await supabase.functions.invoke('generate-order-pdf', {
        body: { orderId: id }
      });

      if (error) throw error;

      // Create a downloadable HTML file
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordem-${order?.patient_name || 'trabalho'}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("PDF gerado com sucesso!", {
        description: "O arquivo HTML foi baixado. Abra-o no navegador e use Imprimir > Salvar como PDF.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF", {
        description: "Não foi possível gerar o PDF da ordem.",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Detalhes da Ordem</h1>
              <p className="text-sm text-muted-foreground">
                {order.patient_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                size="sm"
              >
                {generatingPdf ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Gerar PDF
                  </>
                )}
              </Button>
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Order Info */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Informações da Ordem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Clínica</p>
                    <p className="text-sm font-medium">{order.clinic_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dentista</p>
                    <p className="text-sm font-medium">Dr(a). {order.dentist_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de Trabalho</p>
                    <p className="text-sm font-medium capitalize">{order.work_type.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Criação</p>
                    <p className="text-sm font-medium">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>

              {order.work_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Nome do Trabalho</p>
                  <p className="text-sm font-medium">{order.work_name}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Dentes</p>
                <p className="text-sm font-medium">{order.teeth_numbers}</p>
              </div>

              {order.custom_color && (
                <div>
                  <p className="text-xs text-muted-foreground">Cor</p>
                  <p className="text-sm font-medium">{order.custom_color}</p>
                </div>
              )}

              {order.amount && (
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-sm font-medium">R$ {order.amount.toFixed(2)}</p>
                </div>
              )}

              {order.delivery_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Previsão de Entrega</p>
                  <p className="text-sm font-medium">
                    {new Date(order.delivery_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}

              {order.observations && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm">{order.observations}</p>
                </div>
              )}

              {signatureUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Assinatura Digital</p>
                  <div className="border rounded-lg p-4 bg-white inline-block">
                    <img 
                      src={signatureUrl} 
                      alt="Assinatura" 
                      className="max-w-xs h-24 object-contain"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Upload */}
          <FileUpload 
            orderId={order.id} 
            onUploadComplete={() => setRefreshFiles(prev => prev + 1)}
          />

          {/* File List */}
          <FileList orderId={order.id} refreshTrigger={refreshFiles} />
        </div>
      </main>
    </div>
  );
};

export default OrderDetails;
