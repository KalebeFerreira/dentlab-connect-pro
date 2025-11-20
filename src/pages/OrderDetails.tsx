import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, User, Calendar, FileText, Download, Mail, MessageCircle, Trash2, Eye } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUpload } from "@/components/FileUpload";
import { toast } from "sonner";
import { EmailSendDialog } from "@/components/EmailSendDialog";
import { WhatsAppTemplateSelector } from "@/components/WhatsAppTemplateSelector";
import { STLViewer } from "@/components/STLViewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface OrderFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [refreshFiles, setRefreshFiles] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [stlViewerOpen, setStlViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<OrderFile | null>(null);
  const [labInfo, setLabInfo] = useState<any>(null);

  useEffect(() => {
    checkAuthAndLoadOrder();
    loadFiles();
  }, [id, refreshFiles]);

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

      // Load laboratory info
      const { data: labData } = await supabase
        .from("laboratory_info")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      setLabInfo(labData);
    } catch (error) {
      console.error("Error loading order:", error);
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("order_files")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const handleDownloadFile = async (file: OrderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from("order-files")
        .download(file.file_path);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Arquivo baixado com sucesso!");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    if (!confirm("Tem certeza que deseja excluir este arquivo?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("order-files")
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("order_files")
        .delete()
        .eq("id", fileId);

      if (dbError) throw dbError;

      toast.success("Arquivo excluído com sucesso!");
      loadFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Erro ao excluir arquivo");
    }
  };

  const handleSendEmail = (file: OrderFile) => {
    setSelectedFile(file);
    setEmailDialogOpen(true);
  };

  const handleSendWhatsApp = (file: OrderFile) => {
    setSelectedFile(file);
    setWhatsappDialogOpen(true);
  };

  const handleWhatsAppTemplateSelect = (message: string) => {
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleViewSTL = (file: OrderFile) => {
    setSelectedFile(file);
    setStlViewerOpen(true);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType === "application/pdf") return "📄";
    if (fileType.includes("stl")) return "🔷";
    return "📁";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      geral: "Geral",
      raio_x: "Raio-X",
      stl: "Arquivo STL",
      dicom: "DICOM",
      fotos: "Fotos",
      documentos: "Documentos",
    };
    return labels[category] || category;
  };

  const convertToDocument = (file: OrderFile) => {
    const { data: urlData } = supabase.storage
      .from("order-files")
      .getPublicUrl(file.file_path);

    return {
      file_name: file.file_name,
      file_path: urlData.publicUrl,
      file_size: file.file_size,
      category: "geral",
      file_type: file.file_type,
    };
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

          {/* Files Section */}
          <div className="space-y-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Enviar Arquivos</CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload 
                  orderId={id!} 
                  onUploadComplete={() => setRefreshFiles(prev => prev + 1)}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Arquivos da Ordem</CardTitle>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum arquivo anexado ainda</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(file.file_type)}</span>
                              <span className="truncate max-w-[200px]">
                                {file.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{file.file_type.split("/")[1]?.toUpperCase() || "N/A"}</TableCell>
                          <TableCell>{formatFileSize(file.file_size)}</TableCell>
                          <TableCell>
                            {new Date(file.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadFile(file)}
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {file.file_name.toLowerCase().endsWith(".stl") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewSTL(file)}
                                  title="Visualizar 3D"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendEmail(file)}
                                title="Enviar por Email"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendWhatsApp(file)}
                                title="Enviar por WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteFile(file.id, file.file_path)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      {selectedFile && (
        <>
          <EmailSendDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            document={convertToDocument(selectedFile)}
            labName={labInfo?.lab_name || order?.clinic_name || "Laboratório"}
            getCategoryLabel={getCategoryLabel}
            formatFileSize={formatFileSize}
          />

          <WhatsAppTemplateSelector
            open={whatsappDialogOpen}
            onOpenChange={setWhatsappDialogOpen}
            document={convertToDocument(selectedFile)}
            labName={labInfo?.lab_name || order?.clinic_name || "Laboratório"}
            onTemplateSelect={handleWhatsAppTemplateSelect}
            getCategoryLabel={getCategoryLabel}
            formatFileSize={formatFileSize}
          />

          <Dialog open={stlViewerOpen} onOpenChange={setStlViewerOpen}>
            <DialogContent className="max-w-4xl h-[80vh]">
              <DialogHeader>
                <DialogTitle>Visualizar Arquivo 3D - {selectedFile.file_name}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 h-full">
                <STLViewer fileUrl={selectedFile.file_path} />
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default OrderDetails;
