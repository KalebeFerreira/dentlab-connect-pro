import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Megaphone, 
  Image as ImageIcon, 
  FileUp, 
  Eye, 
  TrendingUp, 
  MousePointer, 
  Users, 
  Calendar,
  Trash2,
  Edit,
  Play,
  Pause,
  BarChart3,
  Target,
  DollarSign,
  Loader2,
  X,
  GripVertical
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CampaignCarousel } from "@/components/marketing/CampaignCarousel";
import { CampaignStats } from "@/components/marketing/CampaignStats";
import { MediaUploader } from "@/components/marketing/MediaUploader";
import { ImageGenerator } from "@/components/marketing/ImageGenerator";
import { CarouselBuilder } from "@/components/marketing/CarouselBuilder";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  campaign_type: string;
  target_audience: string | null;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  created_at: string;
}

interface CampaignMedia {
  id: string;
  campaign_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  media_type: string;
  sort_order: number;
  caption: string | null;
}

const Marketing = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignMedia, setCampaignMedia] = useState<CampaignMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    campaign_type: "promotional",
    target_audience: "",
    budget: "",
    start_date: "",
    end_date: ""
  });

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignMedia(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignMedia = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("campaign_media")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCampaignMedia(data || []);
    } catch (error) {
      console.error("Error loading campaign media:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    try {
      const campaignData = {
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        campaign_type: formData.campaign_type,
        target_audience: formData.target_audience || null,
        budget: formData.budget ? parseFloat(formData.budget) : 0,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      if (isEditMode && selectedCampaign) {
        const { error } = await supabase
          .from("marketing_campaigns")
          .update(campaignData)
          .eq("id", selectedCampaign.id);

        if (error) throw error;
        toast.success("Campanha atualizada!");
      } else {
        const { data, error } = await supabase
          .from("marketing_campaigns")
          .insert(campaignData)
          .select()
          .single();

        if (error) throw error;
        toast.success("Campanha criada!");
        setSelectedCampaign(data);
      }

      setIsDialogOpen(false);
      resetForm();
      loadCampaigns();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Deseja realmente excluir esta campanha?")) return;

    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .delete()
        .eq("id", campaignId);

      if (error) throw error;
      toast.success("Campanha excluída!");
      
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
        setCampaignMedia([]);
      }
      
      loadCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erro ao excluir campanha");
    }
  };

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId);

      if (error) throw error;
      toast.success(`Campanha ${newStatus === "active" ? "ativada" : "pausada"}!`);
      loadCampaigns();
      
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error("Error updating campaign status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      campaign_type: "promotional",
      target_audience: "",
      budget: "",
      start_date: "",
      end_date: ""
    });
    setIsEditMode(false);
  };

  const openEditDialog = (campaign: Campaign) => {
    setFormData({
      title: campaign.title,
      description: campaign.description || "",
      campaign_type: campaign.campaign_type,
      target_audience: campaign.target_audience || "",
      budget: campaign.budget?.toString() || "",
      start_date: campaign.start_date?.split("T")[0] || "",
      end_date: campaign.end_date?.split("T")[0] || ""
    });
    setIsEditMode(true);
    setSelectedCampaign(campaign);
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Rascunho" },
      active: { variant: "default", label: "Ativa" },
      paused: { variant: "outline", label: "Pausada" },
      completed: { variant: "secondary", label: "Concluída" }
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getCampaignTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      promotional: "Promocional",
      awareness: "Reconhecimento",
      engagement: "Engajamento",
      conversion: "Conversão"
    };
    return types[type] || type;
  };

  // Calculate overall stats
  const totalStats = campaigns.reduce((acc, c) => ({
    impressions: acc.impressions + (c.impressions || 0),
    clicks: acc.clicks + (c.clicks || 0),
    conversions: acc.conversions + (c.conversions || 0),
    spent: acc.spent + (c.spent || 0)
  }), { impressions: 0, clicks: 0, conversions: 0, spent: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" />
            Campanhas de Marketing
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie suas campanhas publicitárias
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Editar Campanha" : "Nova Campanha"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nome da campanha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva os objetivos da campanha"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign_type">Tipo</Label>
                  <Select 
                    value={formData.campaign_type} 
                    onValueChange={(value) => setFormData({ ...formData, campaign_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promotional">Promocional</SelectItem>
                      <SelectItem value="awareness">Reconhecimento</SelectItem>
                      <SelectItem value="engagement">Engajamento</SelectItem>
                      <SelectItem value="conversion">Conversão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Orçamento (R$)</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_audience">Público-Alvo</Label>
                <Input
                  id="target_audience"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Ex: Dentistas, Clínicas odontológicas"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data Início</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data Fim</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {isEditMode ? "Salvar Alterações" : "Criar Campanha"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <CampaignStats stats={totalStats} campaignCount={campaigns.length} />

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Campaign List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Suas Campanhas</h2>
          
          {campaigns.length === 0 ? (
            <Card className="p-8 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma campanha criada ainda
              </p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Campanha
              </Button>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {campaigns.map((campaign) => (
                <Card 
                  key={campaign.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedCampaign?.id === campaign.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{campaign.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getCampaignTypeLabel(campaign.campaign_type)}
                        </p>
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {campaign.impressions}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="h-3 w-3" />
                        {campaign.clicks}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        R$ {campaign.spent?.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Details */}
        <div className="lg:col-span-2">
          {selectedCampaign ? (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedCampaign.title}
                      {getStatusBadge(selectedCampaign.status)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedCampaign.description || "Sem descrição"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedCampaign.status === "active" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange(selectedCampaign.id, "paused")}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pausar
                      </Button>
                    ) : selectedCampaign.status !== "completed" && (
                      <Button 
                        size="sm"
                        onClick={() => handleStatusChange(selectedCampaign.id, "active")}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Ativar
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openEditDialog(selectedCampaign)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDelete(selectedCampaign.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="media" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="media">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Mídia</span>
                    </TabsTrigger>
                    <TabsTrigger value="details">
                      <Target className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Detalhes</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Analytics</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="media" className="mt-4 space-y-6">
                    {/* AI Image Generation Section */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <ImageGenerator
                        campaignId={selectedCampaign.id}
                        userId={user?.id || ""}
                        onImageGenerated={(imageData) => {
                          setGeneratedImages(prev => [...prev, imageData]);
                        }}
                      />
                      <CarouselBuilder
                        campaignId={selectedCampaign.id}
                        userId={user?.id || ""}
                        onSaveComplete={() => loadCampaignMedia(selectedCampaign.id)}
                        generatedImages={generatedImages}
                        onClearGeneratedImages={() => setGeneratedImages([])}
                      />
                    </div>

                    {/* Traditional Upload */}
                    <div className="border-t pt-6">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <FileUp className="h-4 w-4" />
                        Upload de Arquivos
                      </h3>
                      <MediaUploader 
                        campaignId={selectedCampaign.id}
                        userId={user?.id || ""}
                        onUploadComplete={() => loadCampaignMedia(selectedCampaign.id)}
                      />
                    </div>
                    
                    {campaignMedia.length > 0 && (
                      <div className="border-t pt-6">
                        <h3 className="font-medium mb-4">Preview do Carrossel Salvo</h3>
                        <CampaignCarousel media={campaignMedia} />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Tipo</p>
                        <p className="font-medium">{getCampaignTypeLabel(selectedCampaign.campaign_type)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Público-Alvo</p>
                        <p className="font-medium">{selectedCampaign.target_audience || "Não definido"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Orçamento</p>
                        <p className="font-medium">R$ {selectedCampaign.budget?.toFixed(2) || "0,00"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Gasto</p>
                        <p className="font-medium">R$ {selectedCampaign.spent?.toFixed(2) || "0,00"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Data Início</p>
                        <p className="font-medium">
                          {selectedCampaign.start_date 
                            ? format(new Date(selectedCampaign.start_date), "dd/MM/yyyy", { locale: ptBR })
                            : "Não definida"
                          }
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Data Fim</p>
                        <p className="font-medium">
                          {selectedCampaign.end_date 
                            ? format(new Date(selectedCampaign.end_date), "dd/MM/yyyy", { locale: ptBR })
                            : "Não definida"
                          }
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="mt-4">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Eye className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-2xl font-bold">{selectedCampaign.impressions}</p>
                          <p className="text-sm text-muted-foreground">Impressões</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <MousePointer className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-2xl font-bold">{selectedCampaign.clicks}</p>
                          <p className="text-sm text-muted-foreground">Cliques</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-2xl font-bold">{selectedCampaign.conversions}</p>
                          <p className="text-sm text-muted-foreground">Conversões</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                          <p className="text-2xl font-bold">
                            {selectedCampaign.impressions > 0 
                              ? ((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(1)
                              : "0"
                            }%
                          </p>
                          <p className="text-sm text-muted-foreground">CTR</p>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <div className="text-center p-8">
                <Megaphone className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Selecione uma campanha
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em uma campanha para ver os detalhes
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketing;
