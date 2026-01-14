import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Save, 
  Loader2, 
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Layers
} from "lucide-react";
import { ExportOptions } from "./ExportOptions";

interface CarouselSlide {
  id: string;
  imageUrl: string;
  caption: string;
  order: number;
}

interface CarouselBuilderProps {
  campaignId: string;
  userId: string;
  onSaveComplete: () => void;
  generatedImages: { url: string; prompt: string }[];
  onClearGeneratedImages: () => void;
}

const MAX_SLIDES = 7;

export const CarouselBuilder = ({ 
  campaignId, 
  userId, 
  onSaveComplete, 
  generatedImages,
  onClearGeneratedImages
}: CarouselBuilderProps) => {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [currentPreview, setCurrentPreview] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add generated image as slide
  const addGeneratedAsSlide = (imageData: { url: string; prompt: string }) => {
    if (slides.length >= MAX_SLIDES) {
      toast.error(`Máximo de ${MAX_SLIDES} slides permitido`);
      return;
    }

    const newSlide: CarouselSlide = {
      id: `slide-${Date.now()}`,
      imageUrl: imageData.url,
      caption: imageData.prompt.slice(0, 100),
      order: slides.length
    };

    setSlides([...slides, newSlide]);
  };

  // Add all generated images
  const addAllGeneratedImages = () => {
    const availableSlots = MAX_SLIDES - slides.length;
    const imagesToAdd = generatedImages.slice(0, availableSlots);

    const newSlides: CarouselSlide[] = imagesToAdd.map((img, index) => ({
      id: `slide-${Date.now()}-${index}`,
      imageUrl: img.url,
      caption: img.prompt.slice(0, 100),
      order: slides.length + index
    }));

    setSlides([...slides, ...newSlides]);
    onClearGeneratedImages();
    toast.success(`${imagesToAdd.length} imagem(ns) adicionada(s)!`);
  };

  // Remove slide
  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides.map((s, i) => ({ ...s, order: i })));
    if (currentPreview >= newSlides.length && newSlides.length > 0) {
      setCurrentPreview(newSlides.length - 1);
    }
  };

  // Update caption
  const updateCaption = (index: number, caption: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], caption };
    setSlides(newSlides);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedIndex];
    newSlides.splice(draggedIndex, 1);
    newSlides.splice(index, 0, draggedSlide);
    
    setSlides(newSlides.map((s, i) => ({ ...s, order: i })));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Save carousel to database
  const handleSave = async () => {
    if (slides.length === 0) {
      toast.error("Adicione pelo menos uma imagem ao carrossel");
      return;
    }

    try {
      setSaving(true);

      // For each slide, we need to save the base64 image to storage
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        
        // Convert base64 to blob if it's a data URL
        if (slide.imageUrl.startsWith('data:')) {
          const response = await fetch(slide.imageUrl);
          const blob = await response.blob();
          
          const fileName = `${Date.now()}-slide-${i}.png`;
          const filePath = `${userId}/${campaignId}/${fileName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("campaign-media")
            .upload(filePath, blob, { contentType: 'image/png' });

          if (uploadError) throw uploadError;

          // Save to database
          const { error: dbError } = await supabase
            .from("campaign_media")
            .insert({
              campaign_id: campaignId,
              user_id: userId,
              file_name: fileName,
              file_path: filePath,
              file_type: 'image/png',
              file_size: blob.size,
              media_type: 'image',
              sort_order: i,
              caption: slide.caption || null
            });

          if (dbError) throw dbError;
        }
      }

      toast.success("Carrossel salvo com sucesso!");
      setSlides([]);
      onSaveComplete();
    } catch (error) {
      console.error("Error saving carousel:", error);
      toast.error("Erro ao salvar carrossel");
    } finally {
      setSaving(false);
    }
  };

  // Preview navigation
  const prevSlide = () => {
    setCurrentPreview(prev => (prev > 0 ? prev - 1 : slides.length - 1));
  };

  const nextSlide = () => {
    setCurrentPreview(prev => (prev < slides.length - 1 ? prev + 1 : 0));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" />
            Construtor de Carrossel
          </span>
          <div className="flex items-center gap-2">
            <ExportOptions 
              images={slides.map(s => ({ url: s.imageUrl, caption: s.caption }))}
              fileName="carrossel-campanha"
              disabled={slides.length === 0}
            />
            <span className="text-sm font-normal text-muted-foreground">
              {slides.length}/{MAX_SLIDES} slides
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add generated images button */}
        {generatedImages.length > 0 && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <span className="font-medium">{generatedImages.length}</span> imagem(ns) gerada(s) disponível(is)
              </p>
              <Button size="sm" onClick={addAllGeneratedImages}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Todas
              </Button>
            </div>
          </div>
        )}

        {/* Carousel Preview */}
        {slides.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img 
                src={slides[currentPreview]?.imageUrl} 
                alt={`Slide ${currentPreview + 1}`}
                className="w-full h-full object-contain"
              />
              
              {slides.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={prevSlide}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={nextSlide}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Slide indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentPreview ? 'bg-primary' : 'bg-primary/30'
                    }`}
                    onClick={() => setCurrentPreview(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Slides List */}
        {slides.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Slides (arraste para reordenar)</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-2 bg-muted/50 rounded-lg cursor-move transition-opacity ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src={slide.imageUrl} 
                      alt={`Slide ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <Input
                      value={slide.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      placeholder="Legenda do slide"
                      className="h-8 text-sm"
                    />
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeSlide(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum slide adicionado</p>
            <p className="text-xs mt-1">Gere imagens com IA e adicione ao carrossel</p>
          </div>
        )}

        {/* Save Button */}
        {slides.length > 0 && (
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando carrossel...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Carrossel ({slides.length} slides)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
