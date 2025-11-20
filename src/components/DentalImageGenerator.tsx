import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

const DENTAL_TEMPLATES = [
  {
    id: "crown",
    name: "Coroa de Porcelana",
    description: "Coroa unitária em cerâmica pura",
    prompt: "Coroa dentária em cerâmica translúcida, textura natural, anatomia detalhada, iluminação de estúdio odontológico, fundo branco neutro, vista frontal, alta resolução",
  },
  {
    id: "implant",
    name: "Implante Dentário",
    description: "Implante com componente protético",
    prompt: "Implante dentário em titânio com componente protético, coroa em cerâmica, estrutura detalhada mostrando parafuso, pilar e coroa, iluminação profissional, fundo branco, vista em corte",
  },
  {
    id: "protocol",
    name: "Protocolo Superior",
    description: "Prótese protocolo fixa sobre implantes",
    prompt: "Prótese tipo protocolo superior, estrutura metálica em titânio, base em resina acrílica rosada, dentes em cerâmica com translucidez, gengiva artificial com textura natural, vista frontal superior, iluminação de laboratório protético",
  },
  {
    id: "bridge",
    name: "Ponte Fixa",
    description: "Ponte de 3 elementos em metal-cerâmica",
    prompt: "Ponte fixa de 3 elementos em metal-cerâmica, anatomia dental detalhada, conexão entre os elementos, acabamento em porcelana translúcida, iluminação de estúdio, fundo neutro, vista lateral",
  },
  {
    id: "veneer",
    name: "Faceta de Porcelana",
    description: "Faceta laminada ultra fina",
    prompt: "Faceta de porcelana ultra fina, translucidez natural, espessura mínima, borda cervical delicada, iluminação que destaca a translucidez, fundo escuro para contraste, vista frontal",
  },
  {
    id: "denture",
    name: "Prótese Total",
    description: "Dentadura completa superior",
    prompt: "Prótese total superior em resina acrílica, dentes artificiais com anatomia natural, base com textura de gengiva, acabamento polido, iluminação de laboratório, fundo branco, vista frontal e palatina",
  },
];

export const DentalImageGenerator = () => {
  const navigate = useNavigate();
  const { subscribed, currentPlan, loading: subLoading, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [workType, setWorkType] = useState("");
  const [teethNumbers, setTeethNumbers] = useState("");
  const [color, setColor] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Por favor, descreva o trabalho dental");
      return;
    }

    setLoading(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-dental-image', {
        body: {
          prompt,
          workType,
          teethNumbers,
          color
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('limite mensal')) {
          toast.error('Limite de gerações atingido. Faça upgrade do seu plano!', {
            action: {
              label: "Ver Planos",
              onClick: () => navigate("/planos"),
            },
          });
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (!data?.imageUrl) {
        throw new Error('Nenhuma imagem foi gerada');
      }

      setGeneratedImage(data.imageUrl);
      setUsageCount(data.usageCount);
      
      toast.success('Imagem gerada com sucesso!');
      refresh();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `dental-work-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Imagem baixada com sucesso!');
  };

  const handleTemplateSelect = (template: typeof DENTAL_TEMPLATES[0]) => {
    setPrompt(template.prompt);
    toast.success(`Template "${template.name}" selecionado`);
  };

  return (
    <div className="space-y-6">
      {!subLoading && (
        <Card className={subscribed ? "bg-primary/5 border-primary/20" : "bg-muted/50"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {subscribed && currentPlan ? (
                    <>
                      <Crown className="h-5 w-5 text-yellow-500" />
                      {currentPlan.name}
                    </>
                  ) : (
                    "Plano Gratuito"
                  )}
                </CardTitle>
                <CardDescription>
                  {subscribed && currentPlan ? (
                    currentPlan.limit === 0 
                      ? "Gerações ilimitadas" 
                      : `${usageCount || 0} de ${currentPlan.limit} gerações este mês`
                  ) : (
                    "Faça upgrade para gerar imagens"
                  )}
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/planos")} variant="outline">
                {subscribed ? "Gerenciar Plano" : "Ver Planos"}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Templates Prontos
            </CardTitle>
            <CardDescription>
              Selecione um template para começar rapidamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {DENTAL_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </div>
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Trabalho</CardTitle>
            <CardDescription>
              Descreva o trabalho dental ou personalize um template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Descrição do Trabalho *</Label>
              <Textarea
                id="prompt"
                placeholder="Descreva detalhadamente o trabalho dental..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workType">Tipo de Trabalho</Label>
                <Input
                  id="workType"
                  placeholder="Ex: Coroa, Implante"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teethNumbers">Elementos</Label>
                <Input
                  id="teethNumbers"
                  placeholder="Ex: 11, 21, 22"
                  value={teethNumbers}
                  onChange={(e) => setTeethNumbers(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor/Tonalidade</Label>
              <Input
                id="color"
                placeholder="Ex: A2, B1, Translúcido"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando Imagem...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Imagem com IA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {generatedImage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Imagem Gerada</CardTitle>
                <CardDescription>
                  Sua visualização do trabalho dental está pronta
                </CardDescription>
              </div>
              <Button onClick={handleDownload} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Baixar Imagem
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={generatedImage}
                alt="Trabalho dental gerado"
                className="w-full h-full object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
