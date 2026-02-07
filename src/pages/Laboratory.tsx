import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Building2, Phone, Mail, Save, Upload, MapPin, FileText, Trash2, Download, Filter, Eye, FileUp, FolderOpen, Settings, MessageSquare, ListChecks, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STLViewer, STLViewerLoading } from "@/components/STLViewer";
import { WhatsAppTemplateManager } from "@/components/WhatsAppTemplateManager";
import { WhatsAppTemplateSelector } from "@/components/WhatsAppTemplateSelector";
import { EmailSendDialog } from "@/components/EmailSendDialog";
import { LaboratoryList } from "@/components/LaboratoryList";

// Lazy load production components
const EmployeeManagement = lazy(() => import("@/components/laboratory/EmployeeManagement").then(m => ({ default: m.EmployeeManagement })));
const WorkRecordManagement = lazy(() => import("@/components/laboratory/WorkRecordManagement").then(m => ({ default: m.WorkRecordManagement })));
const ProductionStats = lazy(() => import("@/components/laboratory/ProductionStats").then(m => ({ default: m.ProductionStats })));
const ProductionGoals = lazy(() => import("@/components/laboratory/ProductionGoals").then(m => ({ default: m.ProductionGoals })));

interface Employee {
  id: string;
  user_id: string;
  name: string;
  role: string;
  status: string;
  notes: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkRecord {
  id: string;
  user_id: string;
  employee_id: string;
  work_type: string;
  work_code: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  value: number | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string>("month");

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
      loadEmployees();
      loadWorkRecords();
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

  const loadEmployees = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar funcionários:", error);
    }
  };

  const loadWorkRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("work_records")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setWorkRecords(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar trabalhos:", error);
    }
  };

  const handleRefreshProduction = () => {
    loadEmployees();
    loadWorkRecords();
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
        <h1 className="text-3xl font-bold mb-2">Dashboard Laboratório</h1>
        <p className="text-muted-foreground">
          Gerencie seu laboratório e visualize todos os laboratórios disponíveis
        </p>
      </div>

      <Tabs defaultValue="my-lab" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="my-lab" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Meu Lab</span>
            <span className="sm:hidden">Lab</span>
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Produção</span>
            <span className="sm:hidden">Prod.</span>
          </TabsTrigger>
          <TabsTrigger value="available-labs" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Labs</span>
            <span className="sm:hidden">Labs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-lab" className="mt-6">

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
        </TabsContent>

        <TabsContent value="available-labs" className="mt-6">
          <LaboratoryList />
        </TabsContent>

        <TabsContent value="production" className="mt-6">
          <div className="space-y-8">
            {/* Link para página de Equipe */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Gerenciar Equipe</h3>
                      <p className="text-sm text-muted-foreground">
                        {employees.length} funcionário(s) cadastrado(s)
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => navigate("/employees")} className="w-full sm:w-auto">
                    <Users className="h-4 w-4 mr-2" />
                    Ir para Equipe
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <WorkRecordManagement 
                workRecords={workRecords} 
                employees={employees} 
                onRefresh={handleRefreshProduction} 
              />
            </Suspense>
            
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <ProductionGoals
                employees={employees}
                workRecords={workRecords}
                userId={userId}
              />
            </Suspense>

            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <ProductionStats 
                employees={employees} 
                workRecords={workRecords}
                periodFilter={periodFilter}
                onPeriodChange={setPeriodFilter}
              labName={labData.lab_name}
              />
            </Suspense>
          </div>
        </TabsContent>
      </Tabs>

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
