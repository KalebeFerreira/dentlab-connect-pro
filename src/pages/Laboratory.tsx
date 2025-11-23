import { useState, useEffect, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Building2, Phone, Mail, Save, Upload, MapPin, FileText, Trash2, Download, Filter, Eye, FileUp, FolderOpen, Settings, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STLViewer, STLViewerLoading } from "@/components/STLViewer";
import { WhatsAppTemplateManager } from "@/components/WhatsAppTemplateManager";
import { WhatsAppTemplateSelector } from "@/components/WhatsAppTemplateSelector";
import { EmailSendDialog } from "@/components/EmailSendDialog";

interface LaboratoryData {
  id?: string;
  lab_name: string;
  whatsapp: string;
  email: string;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
  description?: string | null;
  is_public?: boolean;
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string | null;
  category: string;
  created_at: string;
}

const DOCUMENT_CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "stl", label: "Arquivos Digitais STL" },
  { value: "contrato", label: "Contrato" },
  { value: "certificado", label: "Certificado" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "alvara", label: "Alvará" },
  { value: "licenca", label: "Licença" },
  { value: "comprovante", label: "Comprovante" },
  { value: "outros", label: "Outros" },
];

const Laboratory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [labData, setLabData] = useState<LaboratoryData>({
    lab_name: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    country: "Brasil",
    description: "",
    is_public: true,
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("geral");
  const [filterCategory, setFilterCategory] = useState<string>("todos");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedSTL, setSelectedSTL] = useState<Document | null>(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<Document | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [documentToEmail, setDocumentToEmail] = useState<Document | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    } else {
      setUserId(user.id);
      loadLaboratoryInfo();
      loadDocuments();
    }
  };

  const loadLaboratoryInfo = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("laboratory_info")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setLabData({
          id: data.id,
          lab_name: data.lab_name,
          whatsapp: data.whatsapp,
          email: data.email,
          logo_url: data.logo_url,
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          country: data.country || "Brasil",
          description: data.description || "",
          is_public: data.is_public ?? true,
        });
      }
    } catch (error: any) {
      toast.error("Erro ao carregar informações", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("laboratory_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      setFilteredDocuments(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar documentos", { description: error.message });
    }
  };

  const handleFilterChange = (category: string) => {
    setFilterCategory(category);
    if (category === "todos") {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter(doc => doc.category === category));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('laboratory-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('laboratory-files')
        .getPublicUrl(fileName);

      setLabData({ ...labData, logo_url: publicUrl });
      toast.success("Logo enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar logo", { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20MB");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/documents/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('laboratory-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('laboratory-files')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("laboratory_documents")
        .insert({
          user_id: userId,
          laboratory_id: labData.id,
          file_name: file.name,
          file_path: publicUrl,
          file_type: file.type,
          file_size: file.size,
          category: selectedCategory,
        });

      if (dbError) throw dbError;

      toast.success("Arquivo enviado com sucesso!");
      loadDocuments();
      setSelectedCategory("geral");
      e.target.value = '';
    } catch (error: any) {
      toast.error("Erro ao enviar arquivo", { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = DOCUMENT_CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const getCategoryColor = (category: string): "default" | "secondary" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "outline"> = {
      stl: "default",
      contrato: "default",
      certificado: "secondary",
      nota_fiscal: "outline",
    };
    return colors[category] || "outline";
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      const filePath = doc.file_path.split('/laboratory-files/')[1];
      
      const { error: storageError } = await supabase.storage
        .from('laboratory-files')
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("laboratory_documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Documento excluído com sucesso!");
      loadDocuments();
    } catch (error: any) {
      toast.error("Erro ao excluir documento", { description: error.message });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!labData.lab_name || !labData.whatsapp || !labData.email) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (labData.id) {
        const { error } = await supabase
          .from("laboratory_info")
          .update({
            lab_name: labData.lab_name,
            whatsapp: labData.whatsapp,
            email: labData.email,
            logo_url: labData.logo_url,
            address: labData.address,
            city: labData.city,
            state: labData.state,
            zip_code: labData.zip_code,
            country: labData.country,
            description: labData.description,
            is_public: labData.is_public,
          })
          .eq("id", labData.id);

        if (error) throw error;
        toast.success("Informações atualizadas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("laboratory_info")
          .insert({
            user_id: user.id,
            lab_name: labData.lab_name,
            whatsapp: labData.whatsapp,
            email: labData.email,
            logo_url: labData.logo_url,
            address: labData.address,
            city: labData.city,
            state: labData.state,
            zip_code: labData.zip_code,
            country: labData.country,
            description: labData.description,
            is_public: labData.is_public,
          })
          .select()
          .single();

        if (error) throw error;
        setLabData({ ...labData, id: data.id });
        toast.success("Informações cadastradas com sucesso!");
      }
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isSTLFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith('.stl');
  };

  const handleViewSTL = (doc: Document) => {
    setSelectedSTL(doc);
    setViewerOpen(true);
  };

  const handleShareWhatsApp = (doc: Document) => {
    setDocumentToShare(doc);
    setTemplateSelectorOpen(true);
  };

  const handleTemplateSelect = (message: string) => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSendEmail = (doc: Document) => {
    setDocumentToEmail(doc);
    setEmailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Informações do Laboratório</h1>
        <p className="text-muted-foreground">
          Gerencie os dados e documentos do seu laboratório
        </p>
      </div>

      <div className="grid gap-6 max-w-6xl">
        {/* Card de Logo */}
        <Card id="lab-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Logo do Laboratório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {labData.logo_url ? (
                <img 
                  src={labData.logo_url} 
                  alt="Logo" 
                  className="h-24 w-24 object-contain rounded-lg border"
                />
              ) : (
                <div className="h-24 w-24 bg-muted rounded-lg flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <Label htmlFor="logo" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    Formatos aceitos: JPG, PNG (máx. 5MB)
                  </div>
                  <Button type="button" variant="outline" disabled={uploading} asChild>
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading ? "Enviando..." : "Enviar Logo"}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Principal - Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados Básicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lab_name">Nome do Laboratório *</Label>
                  <Input
                    id="lab_name"
                    value={labData.lab_name}
                    onChange={(e) => setLabData({ ...labData, lab_name: e.target.value })}
                    placeholder="Ex: DentLab Próteses"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp (com DDD) *</Label>
                  <Input
                    id="whatsapp"
                    value={labData.whatsapp}
                    onChange={(e) => setLabData({ ...labData, whatsapp: e.target.value })}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={labData.email}
                    onChange={(e) => setLabData({ ...labData, email: e.target.value })}
                    placeholder="contato@dentlab.com.br"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Descrição do Laboratório</Label>
                  <Input
                    id="description"
                    value={labData.description || ""}
                    onChange={(e) => setLabData({ ...labData, description: e.target.value })}
                    placeholder="Especializado em próteses sobre implante e restaurações estéticas"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={labData.is_public ?? true}
                      onChange={(e) => setLabData({ ...labData, is_public: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="is_public" className="cursor-pointer">
                      Tornar laboratório visível para dentistas e clínicas
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, seu laboratório aparecerá na lista de laboratórios disponíveis
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Rua/Avenida</Label>
                    <Input
                      id="address"
                      value={labData.address || ""}
                      onChange={(e) => setLabData({ ...labData, address: e.target.value })}
                      placeholder="Rua das Flores, 123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={labData.city || ""}
                      onChange={(e) => setLabData({ ...labData, city: e.target.value })}
                      placeholder="São Paulo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={labData.state || ""}
                      onChange={(e) => setLabData({ ...labData, state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zip_code">CEP</Label>
                    <Input
                      id="zip_code"
                      value={labData.zip_code || ""}
                      onChange={(e) => setLabData({ ...labData, zip_code: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input
                      id="country"
                      value={labData.country || ""}
                      onChange={(e) => setLabData({ ...labData, country: e.target.value })}
                      placeholder="Brasil"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Informações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card de Documentos */}
        <Card id="documents-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos e Arquivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button type="button" variant="default" disabled={uploading} asChild>
                      <span>
                        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        {uploading ? "Enviando..." : "Enviar Arquivo"}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Formatos aceitos: Imagens, PDF, Word, Excel (máx. 20MB)
              </p>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-4 w-4" />
                  <Label>Filtrar por categoria:</Label>
                  <Select value={filterCategory} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {documents.length === 0 
                  ? "Nenhum documento enviado ainda" 
                  : "Nenhum documento encontrado nesta categoria"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Arquivo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryColor(doc.category)}>
                          {getCategoryLabel(doc.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.file_type || "N/A"}</TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isSTLFile(doc.file_name) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewSTL(doc)}
                              title="Visualizar 3D"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleShareWhatsApp(doc)}
                            title="Compartilhar via WhatsApp"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendEmail(doc)}
                            title="Enviar por Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.file_path, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDocument(doc)}
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

        {/* Templates de Mensagens WhatsApp */}
        <div id="templates-section">
          <WhatsAppTemplateManager />
        </div>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Visualizador 3D - {selectedSTL?.file_name}
            </DialogTitle>
          </DialogHeader>
          {selectedSTL && (
            <Suspense fallback={<STLViewerLoading />}>
              <STLViewer fileUrl={selectedSTL.file_path} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      <WhatsAppTemplateSelector
        open={templateSelectorOpen}
        onOpenChange={setTemplateSelectorOpen}
        document={documentToShare}
        labName={labData.lab_name || "Laboratório"}
        onTemplateSelect={handleTemplateSelect}
        getCategoryLabel={getCategoryLabel}
        formatFileSize={formatFileSize}
      />

      <EmailSendDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        document={documentToEmail}
        labName={labData.lab_name || "Laboratório"}
        getCategoryLabel={getCategoryLabel}
        formatFileSize={formatFileSize}
      />
    </div>
  );
};

export default Laboratory;
