import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Plus, Image as ImageIcon } from "lucide-react";

interface ImageGeneratorProps {
  campaignId: string;
  userId: string;
  onImageGenerated: (imageData: { url: string; prompt: string }) => void;
}

const PROMPT_TEMPLATES = [
  { id: "promo", label: "Promoção", prompt: "Promotional banner with discount offer, modern design" },
  { id: "dental", label: "Odontológico", prompt: "Professional dental clinic advertisement, clean and trustworthy" },
  { id: "health", label: "Saúde", prompt: "Healthcare services promotion, warm and caring atmosphere" },
  { id: "social", label: "Redes Sociais", prompt: "Eye-catching social media post, vibrant colors and modern layout" },
  { id: "event", label: "Evento", prompt: "Event announcement banner, exciting and inviting design" },
];

export const ImageGenerator = ({ campaignId, userId, onImageGenerated }: ImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [includeText, setIncludeText] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite uma descrição para a imagem");
      return;
    }

    try {
      setGenerating(true);
      setGeneratedImage(null);

      const { data, error } = await supabase.functions.invoke('generate-campaign-image', {
        body: { 
          prompt, 
          includeText, 
          textContent: includeText ? textContent : undefined 
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.image) {
        setGeneratedImage(data.image);
        toast.success("Imagem gerada com sucesso!");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(error.message || "Erro ao gerar imagem");
    } finally {
      setGenerating(false);
    }
  };

  const handleAddToCarousel = () => {
    if (generatedImage) {
      onImageGenerated({ url: generatedImage, prompt });
      toast.success("Imagem adicionada ao carrossel!");
      setGeneratedImage(null);
      setPrompt("");
      setTextContent("");
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `campaign-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Gerar Imagem com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt Templates */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Templates rápidos</Label>
          <div className="flex flex-wrap gap-2">
            {PROMPT_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                size="sm"
                onClick={() => setPrompt(template.prompt)}
                className="text-xs"
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Descrição da imagem *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem que deseja gerar para sua campanha..."
            rows={3}
          />
        </div>

        {/* Include Text Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="include-text" className="font-medium">Incluir texto na imagem</Label>
            <p className="text-xs text-muted-foreground">
              Adicione texto promocional diretamente na imagem
            </p>
          </div>
          <Switch
            id="include-text"
            checked={includeText}
            onCheckedChange={setIncludeText}
          />
        </div>

        {/* Text Content Input */}
        {includeText && (
          <div className="space-y-2">
            <Label htmlFor="text-content">Texto para incluir</Label>
            <Input
              id="text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Ex: 20% OFF, Promoção de Verão, etc."
            />
          </div>
        )}

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate} 
          disabled={generating || !prompt.trim()}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando imagem...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Imagem
            </>
          )}
        </Button>

        {/* Generated Image Preview */}
        {generatedImage && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-medium">Imagem Gerada</Label>
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <img 
                src={generatedImage} 
                alt="Imagem gerada"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
              <Button 
                size="sm" 
                onClick={handleAddToCarousel}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ao Carrossel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
