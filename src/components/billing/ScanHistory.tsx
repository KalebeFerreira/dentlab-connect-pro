import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Calendar
} from "lucide-react";

interface ScannedDocument {
  id: string;
  image_url: string;
  clinic_name: string | null;
  patient_name: string | null;
  service_name: string | null;
  service_value: number | null;
  created_at: string;
}

interface ScanHistoryProps {
  refreshTrigger?: number;
}

export const ScanHistory = ({ refreshTrigger }: ScanHistoryProps) => {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDocument | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
        .limit(50);

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Histórico de Scans ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div 
                    className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <img
                      src={doc.image_url}
                      alt="Documento escaneado"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {doc.service_name || 'Serviço'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.clinic_name || 'Clínica não informada'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Documento</DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedDoc.image_url}
                  alt="Documento escaneado"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Clínica</p>
                    <p className="font-medium">{selectedDoc.clinic_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="font-medium">{selectedDoc.patient_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Serviço</p>
                    <p className="font-medium">{selectedDoc.service_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
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
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
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
