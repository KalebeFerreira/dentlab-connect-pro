import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

interface CampaignCarouselProps {
  media: CampaignMedia[];
  onDelete?: (mediaId: string) => void;
  editable?: boolean;
}

export const CampaignCarousel = ({ media, onDelete, editable = true }: CampaignCarouselProps) => {
  const [deleting, setDeleting] = useState<string | null>(null);

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("campaign-media")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleDelete = async (mediaItem: CampaignMedia) => {
    if (!confirm("Deseja remover esta mídia?")) return;

    try {
      setDeleting(mediaItem.id);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("campaign-media")
        .remove([mediaItem.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("campaign_media")
        .delete()
        .eq("id", mediaItem.id);

      if (dbError) throw dbError;

      toast.success("Mídia removida!");
      onDelete?.(mediaItem.id);
    } catch (error) {
      console.error("Error deleting media:", error);
      toast.error("Erro ao remover mídia");
    } finally {
      setDeleting(null);
    }
  };

  if (media.length === 0) {
    return (
      <Card className="p-8 text-center bg-muted/30">
        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhuma mídia adicionada</p>
      </Card>
    );
  }

  const isImage = (fileType: string) => fileType.startsWith("image/");

  return (
    <Carousel className="w-full max-w-xl mx-auto">
      <CarouselContent>
        {media.map((item) => (
          <CarouselItem key={item.id}>
            <Card className="relative overflow-hidden">
              {isImage(item.file_type) ? (
                <div className="aspect-video relative">
                  <img
                    src={getPublicUrl(item.file_path)}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                  />
                  {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-white text-sm">{item.caption}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center bg-muted">
                  <FileText className="h-16 w-16 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center px-4 truncate max-w-full">
                    {item.file_name}
                  </p>
                  {item.caption && (
                    <p className="text-xs text-muted-foreground mt-2">{item.caption}</p>
                  )}
                </div>
              )}

              {editable && (
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => handleDelete(item)}
                  disabled={deleting === item.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2" />
      <CarouselNext className="right-2" />
    </Carousel>
  );
};
