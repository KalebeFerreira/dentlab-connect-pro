import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  Loader2, 
  Trash2, 
  Eye,
  Building2,
  User,
  FileText,
  DollarSign,
  Calendar,
  FileImage,
  File,
  Filter,
  Download
} from "lucide-react";

interface ScannedDocument {
  id: string;
  image_url: string;
  clinic_name: string | null;
  patient_name: string | null;
  service_name: string | null;
  service_value: number | null;
  created_at: string;
  file_type?: string | null;
  file_name?: string | null;
}

interface ScanHistoryProps {
  refreshTrigger?: number;
}

export const ScanHistory = ({ refreshTrigger }: ScanHistoryProps) => {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDocument | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("all");

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('scanned_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('scanned_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setDocuments(docs => docs.filter(d => d.id !== id));
      toast.success('Documento removido do histórico');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir documento');
    } finally {
      setDeleting(null);
    }
  };

  const getAvailableClients = () => {
    const clients = new Set<string>();
    documents.forEach(doc => {
      if (doc.clinic_name) {
        clients.add(doc.clinic_name);
      }
    });
    return Array.from(clients).sort();
  };

  const filteredDocuments = selectedClient === "all" 
    ? documents 
    : documents.filter(doc => doc.clinic_name === selectedClient);

  const getFileIcon = (fileType?: string | null) => {
    if (!fileType || fileType.startsWith('image/')) {
      return <FileImage className="h-4 w-4 text-blue-500" />;
    }
    if (fileType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-4 w-4 text-blue-600" />;
    }
    if (fileType.includes('excel') || fileType.includes('sheet')) {
      return <FileText className="h-4 w-4 text-green-600" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const isImageFile = (fileType?: string | null) => {
    return !fileType || fileType.startsWith('image/');
  };

  const handleDownload = async (doc: ScannedDocument) => {
    try {
      const link = document.createElement('a');
      link.href = doc.image_url;
      link.download = doc.file_name || 'documento';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao baixar:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const availableClients = getAvailableClients();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <History className="h-5 w-5" />
            Histórico de Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum documento escaneado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <span className="text-base sm:text-lg">Histórico de Scans ({filteredDocuments.length})</span>
            </div>
            
            {availableClients.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-full sm:w-[200px] h-9">
                    <SelectValue placeholder="Filtrar por cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {availableClients.map(client => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px] sm:h-[300px] pr-2 sm:pr-4">
            <div className="space-y-2 sm:space-y-3">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div 
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer flex items-center justify-center"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    {isImageFile(doc.file_type) ? (
                      <img
                        src={doc.image_url}
                        alt="Documento escaneado"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getFileIcon(doc.file_type)
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">
                      {doc.service_name || 'Serviço'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.clinic_name || 'Cliente não informado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                    >
                      {deleting === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon(selectedDoc?.file_type)}
              Detalhes do Documento
            </DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {isImageFile(selectedDoc.file_type) ? (
                  <img
                    src={selectedDoc.image_url}
                    alt="Documento escaneado"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6">
                    {selectedDoc.file_type?.includes('pdf') ? (
                      <FileText className="h-16 w-16 text-red-500" />
                    ) : selectedDoc.file_type?.includes('word') || selectedDoc.file_type?.includes('document') ? (
                      <FileText className="h-16 w-16 text-blue-600" />
                    ) : selectedDoc.file_type?.includes('excel') || selectedDoc.file_type?.includes('sheet') ? (
                      <FileText className="h-16 w-16 text-green-600" />
                    ) : (
                      <File className="h-16 w-16 text-muted-foreground" />
                    )}
                    <p className="text-sm text-muted-foreground text-center">
                      {selectedDoc.file_name || 'Documento'}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownload(selectedDoc)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Arquivo
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium truncate">{selectedDoc.clinic_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="font-medium truncate">{selectedDoc.patient_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Serviço</p>
                    <p className="font-medium truncate">{selectedDoc.service_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-medium">
                      {selectedDoc.service_value 
                        ? `R$ ${selectedDoc.service_value.toFixed(2)}`
                        : '-'
                      }
                    </p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-2 p-2 rounded bg-muted/50">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Data do Scan</p>
                    <p className="font-medium">
                      {format(new Date(selectedDoc.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
