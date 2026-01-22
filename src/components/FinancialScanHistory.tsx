import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import ExcelJS from 'exceljs';
import { 
  History, 
  Loader2, 
  Trash2, 
  Eye,
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  Calendar,
  FileDown,
  FileSpreadsheet,
  FileImage,
  File,
  Filter,
  Download,
  Building2
} from "lucide-react";

interface FinancialScannedDocument {
  id: string;
  image_url: string;
  file_name: string | null;
  file_type: string | null;
  transaction_type: string | null;
  amount: number | null;
  description: string | null;
  vendor_name: string | null;
  document_number: string | null;
  document_date: string | null;
  created_at: string;
}

interface FinancialScanHistoryProps {
  refreshTrigger?: number;
}

export const FinancialScanHistory = ({ refreshTrigger }: FinancialScanHistoryProps) => {
  const [documents, setDocuments] = useState<FinancialScannedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<FinancialScannedDocument | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('financial_scanned_documents' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setDocuments((data as unknown as FinancialScannedDocument[]) || []);
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
        .from('financial_scanned_documents' as any)
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

  const getAvailableMonths = () => {
    const months = new Set<string>();
    documents.forEach(doc => {
      const date = new Date(doc.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  };

  const filteredDocuments = documents.filter(doc => {
    if (filterType !== "all" && doc.transaction_type !== filterType) return false;
    if (filterMonth !== "all") {
      const date = new Date(doc.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey !== filterMonth) return false;
    }
    return true;
  });

  const getFileIcon = (fileType?: string | null) => {
    if (!fileType || fileType.startsWith('image/')) {
      return <FileImage className="h-4 w-4 text-primary" />;
    }
    if (fileType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-destructive" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const isImageFile = (fileType?: string | null) => {
    return !fileType || fileType.startsWith('image/');
  };

  const handleDownload = async (doc: FinancialScannedDocument) => {
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

  const formatCurrency = (value: number | null) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy', { locale: ptBR });
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Histórico de Escaneamentos');
      
      worksheet.columns = [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Valor', key: 'amount', width: 15 },
        { header: 'Descrição', key: 'description', width: 30 },
        { header: 'Fornecedor', key: 'vendor', width: 20 },
        { header: 'Nº Documento', key: 'docNumber', width: 15 },
      ];

      filteredDocuments.forEach(doc => {
        worksheet.addRow({
          date: doc.document_date ? format(new Date(doc.document_date), 'dd/MM/yyyy') : format(new Date(doc.created_at), 'dd/MM/yyyy'),
          type: doc.transaction_type === 'receipt' ? 'Receita' : 'Despesa',
          amount: doc.amount || 0,
          description: doc.description || '',
          vendor: doc.vendor_name || '',
          docNumber: doc.document_number || '',
        });
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF22C55E' }
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `historico_escaneamentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('Arquivo Excel exportado!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Escaneamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <FileImage className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum documento financeiro escaneado ainda.</p>
          <p className="text-sm mt-2">Os documentos escaneados aparecerão aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Escaneamentos
              <Badge variant="secondary" className="ml-2">
                {filteredDocuments.length}
              </Badge>
            </CardTitle>
            
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receipt">Receitas</SelectItem>
                  <SelectItem value="payment">Despesas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {getAvailableMonths().map(month => (
                    <SelectItem key={month} value={month}>
                      {formatMonthLabel(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-3">
              {filteredDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {isImageFile(doc.file_type) ? (
                      <img 
                        src={doc.image_url} 
                        alt="Documento"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setSelectedDoc(doc)}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        {getFileIcon(doc.file_type)}
                        <span className="text-[10px] text-muted-foreground">
                          {doc.file_type?.split('/').pop()?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {doc.transaction_type === 'receipt' ? (
                        <Badge variant="outline" className="bg-accent text-accent-foreground border-accent">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Receita
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Despesa
                        </Badge>
                      )}
                      <span className="font-semibold text-sm">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate">
                      {doc.description || 'Sem descrição'}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {doc.vendor_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {doc.vendor_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
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
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                    >
                      {deleting === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Documento
            </DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="rounded-lg overflow-hidden border bg-muted">
                {isImageFile(selectedDoc.file_type) ? (
                  <img 
                    src={selectedDoc.image_url} 
                    alt="Documento"
                    className="w-full max-h-[400px] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    {getFileIcon(selectedDoc.file_type)}
                    <span className="text-sm text-muted-foreground mt-2">
                      {selectedDoc.file_name || 'Documento'}
                    </span>
                  </div>
                )}
              </div>

              {/* Document Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <div className="flex items-center gap-2">
                    {selectedDoc.transaction_type === 'receipt' ? (
                      <Badge variant="outline" className="bg-accent text-accent-foreground">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Receita
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Despesa
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Valor</label>
                  <p className="font-semibold flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(selectedDoc.amount)}
                  </p>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-muted-foreground">Descrição</label>
                  <p className="text-sm">{selectedDoc.description || 'Sem descrição'}</p>
                </div>

                {selectedDoc.vendor_name && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fornecedor</label>
                    <p className="text-sm flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {selectedDoc.vendor_name}
                    </p>
                  </div>
                )}

                {selectedDoc.document_number && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nº Documento</label>
                    <p className="text-sm">{selectedDoc.document_number}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Data do Escaneamento</label>
                  <p className="text-sm flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedDoc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {selectedDoc.document_date && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data do Documento</label>
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(selectedDoc.document_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handleDownload(selectedDoc)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    handleDelete(selectedDoc.id);
                    setSelectedDoc(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
