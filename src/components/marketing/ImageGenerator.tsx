import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Plus, Image as ImageIcon } from "lucide-react";
import { CarouselTemplates } from "./CarouselTemplates";

interface ImageGeneratorProps {
  campaignId: string;
  userId: string;
  onImageGenerated: (imageData: { url: string; prompt: string }) => void;
  onBatchGenerated?: (images: { url: string; prompt: string }[]) => void;
}

const PROMPT_TEMPLATES = [
  { id: "promo", label: "Promoção", prompt: "Promotional banner with discount offer, modern design" },
  { id: "dental", label: "Odontológico", prompt: "Professional dental clinic advertisement, clean and trustworthy" },
  { id: "health", label: "Saúde", prompt: "Healthcare services promotion, warm and caring atmosphere" },
  { id: "social", label: "Redes Sociais", prompt: "Eye-catching social media post, vibrant colors and modern layout" },
  { id: "event", label: "Evento", prompt: "Event announcement banner, exciting and inviting design" },
];

export const ImageGenerator = ({ campaignId, userId, onImageGenerated, onBatchGenerated }: ImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [includeText, setIncludeText] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateSingleImage = async (imagePrompt: string, imageText?: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-image', {
        body: { 
          prompt: imagePrompt, 
          includeText: !!imageText, 
          textContent: imageText 
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data?.image || null;
    } catch (error) {
      console.error("Error generating image:", error);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite uma descrição para a imagem");
      return;
    }

    try {
      setGenerating(true);
      setGeneratedImage(null);

      const image = await generateSingleImage(prompt, includeText ? textContent : undefined);

      if (image) {
        setGeneratedImage(image);
        toast.success("Imagem gerada com sucesso!");
      } else {
        toast.error("Erro ao gerar imagem");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateSelect = async (slides: { prompt: string; suggestedText?: string }[]) => {
    if (batchGenerating) return;
    
    try {
      setBatchGenerating(true);
      setBatchProgress(0);
      
      const generatedImages: { url: string; prompt: string }[] = [];
      const totalSlides = slides.length;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        toast.info(`Gerando imagem ${i + 1} de ${totalSlides}...`);
        
        const image = await generateSingleImage(slide.prompt, slide.suggestedText);
        
        if (image) {
          generatedImages.push({ url: image, prompt: slide.suggestedText || slide.prompt });
          onImageGenerated({ url: image, prompt: slide.suggestedText || slide.prompt });
        }

        setBatchProgress(((i + 1) / totalSlides) * 100);
        
        // Small delay between requests to avoid rate limiting
        if (i < slides.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (generatedImages.length > 0) {
        toast.success(`${generatedImages.length} imagens geradas com sucesso!`);
        if (onBatchGenerated) {
          onBatchGenerated(generatedImages);
        }
      } else {
        toast.error("Não foi possível gerar as imagens");
      }
    } catch (error) {
      console.error("Batch generation error:", error);
      toast.error("Erro ao gerar imagens em lote");
    } finally {
      setBatchGenerating(false);
      setBatchProgress(0);
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

  const isGenerating = generating || batchGenerating;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Gerar Imagem com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Carousel Templates */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Templates de Carrossel</Label>
          <CarouselTemplates 
            onSelectTemplate={handleTemplateSelect}
            isGenerating={isGenerating}
          />
        </div>

        {/* Batch Progress */}
        {batchGenerating && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Gerando carrossel...</span>
              <span>{Math.round(batchProgress)}%</span>
            </div>
            <Progress value={batchProgress} className="h-2" />
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
            <div className="flex-1 border-t" />
            <span className="px-3 text-xs text-muted-foreground bg-card">ou gere imagem única</span>
            <div className="flex-1 border-t" />
          </div>
          <div className="h-6" />
        </div>

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
                disabled={isGenerating}
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
            disabled={isGenerating}
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
            disabled={isGenerating}
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
              disabled={isGenerating}
            />
          </div>
        )}

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !prompt.trim()}
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
