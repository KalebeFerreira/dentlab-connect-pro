import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Image as ImageIcon } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [workType, setWorkType] = useState("");
  const [teethNumbers, setTeethNumbers] = useState("");
  const [color, setColor] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

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
        if (data.error.includes('Rate limit')) {
          toast.error('Limite de uso excedido. Tente novamente mais tarde.');
        } else if (data.error.includes('Payment required')) {
          toast.error('Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (!data?.imageUrl) {
        throw new Error('Nenhuma imagem foi gerada');
      }

      setGeneratedImage(data.imageUrl);
      toast.success('Imagem gerada com sucesso!');
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
    toast.success('Download iniciado!');
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador de Visualizações com IA
          </CardTitle>
          <CardDescription>
            Escolha um template ou descreva o trabalho dentário que deseja visualizar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Templates Gallery */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Templates Pré-definidos
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DENTAL_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-elevated transition-smooth hover:border-primary"
                  onClick={() => setPrompt(template.prompt)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="prompt">Descrição do Trabalho *</Label>
            <Textarea
              id="prompt"
              placeholder="Descreva o trabalho dental que deseja visualizar. Ex: Coroa dentária de porcelana na região anterior, implante com prótese sobre implante, restauração estética..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="workType">Tipo de Trabalho</Label>
              <Input
                id="workType"
                placeholder="Ex: Coroa, Implante, Prótese"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="teethNumbers">Dentes</Label>
              <Input
                id="teethNumbers"
                placeholder="Ex: 11, 21, 31-34"
                value={teethNumbers}
                onChange={(e) => setTeethNumbers(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                placeholder="Ex: A2, B1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando Imagem...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Visualização
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedImage && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Imagem Gerada</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-lg overflow-hidden bg-muted">
              <img
                src={generatedImage}
                alt="Visualização gerada"
                className="w-full h-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Use esta visualização como referência para o trabalho dental. 
              A imagem é gerada por IA e pode não representar exatamente o resultado final.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
