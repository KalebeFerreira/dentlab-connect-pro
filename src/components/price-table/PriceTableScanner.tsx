import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Camera, Upload, FileImage } from "lucide-react";

interface ScannedItem {
  workType: string;
  description: string;
  price: string;
}

interface PriceTableScannerProps {
  onItemsScanned: (items: ScannedItem[]) => void;
}

export const PriceTableScanner = ({ onItemsScanned }: PriceTableScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setScanning(true);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(base64);

      // Call edge function to scan document
      const { data, error } = await supabase.functions.invoke("scan-price-table", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (data?.items && data.items.length > 0) {
        onItemsScanned(data.items);
        toast.success(`${data.items.length} item(ns) extraído(s) com sucesso!`);
        setPreview(null);
      } else {
        toast.warning("Nenhum item identificado", {
          description: "Tente uma imagem mais clara ou adicione manualmente",
        });
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      toast.error("Erro ao escanear", { description: error.message });
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Formato inválido", { description: "Use imagem ou PDF" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "Máximo 10MB" });
      return;
    }

    await processImage(file);
    
    // Reset input
    if (e.target) e.target.value = "";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileImage className="h-5 w-5" />
          Scanner Automático
        </CardTitle>
        <CardDescription>
          Envie foto ou arquivo de tabela de preços para gerar itens automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-48 object-contain rounded-lg border"
            />
            {scanning && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm font-medium">Analisando...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Clique para selecionar ou arraste aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Imagem ou PDF de tabela de preços
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
          >
            <Camera className="h-4 w-4" />
            Câmera
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
          >
            <Upload className="h-4 w-4" />
            Arquivo
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
};
