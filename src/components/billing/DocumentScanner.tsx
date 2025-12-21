import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Camera, 
  Upload, 
  Scan, 
  Loader2, 
  X, 
  Check,
  FileImage,
  Layers,
  SkipForward
} from "lucide-react";

interface ExtractedData {
  clinic_name: string | null;
  patient_name: string | null;
  service_name: string | null;
  service_value: number | null;
}

interface DocumentScannerProps {
  onServiceAdd: () => void;
  onScanComplete?: () => void;
}

export const DocumentScanner = ({ onServiceAdd, onScanComplete }: DocumentScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Batch mode states
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      toast.error('Não foi possível acessar a câmera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setPreviewImage(imageData);
        stopCamera();
        processImage(imageData);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setPreviewImage(imageData);
        processImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageBase64: string) => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-document', {
        body: { imageBase64 }
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.data) {
        setExtractedData(data.data);
        setShowConfirmDialog(true);
        toast.success('Dados extraídos com sucesso!');
      } else {
        throw new Error(data?.error || 'Erro ao processar imagem');
      }
    } catch (error: any) {
      console.error('Erro ao processar documento:', error);
      toast.error('Erro ao processar documento: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsScanning(false);
    }
  };

  const uploadImageToStorage = async (userId: string, imageBase64: string): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const base64Data = imageBase64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `${userId}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('scanned-documents')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('scanned-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      return null;
    }
  };

  const handleConfirmData = async () => {
    if (!extractedData || !previewImage) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Upload image to storage
      const imageUrl = await uploadImageToStorage(user.id, previewImage);

      // Insert service
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
          service_name: extractedData.service_name || 'Serviço escaneado',
          service_value: extractedData.service_value || 0,
          client_name: extractedData.clinic_name,
          patient_name: extractedData.patient_name,
          service_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      // Save scan history with image
      if (imageUrl) {
        const { error: historyError } = await supabase
          .from('scanned_documents')
          .insert({
            user_id: user.id,
            image_url: imageUrl,
            clinic_name: extractedData.clinic_name,
            patient_name: extractedData.patient_name,
            service_name: extractedData.service_name,
            service_value: extractedData.service_value,
            service_id: serviceData?.id
          });

        if (historyError) {
          console.error('Erro ao salvar histórico:', historyError);
        }
      }

      // Update batch count
      if (batchMode) {
        setBatchCount(prev => prev + 1);
        toast.success(`Documento ${batchCount + 1} adicionado! Pronto para o próximo.`);
      } else {
        toast.success('Serviço adicionado ao relatório!');
      }
      
      setShowConfirmDialog(false);
      setExtractedData(null);
      setPreviewImage(null);
      onServiceAdd();
      onScanComplete?.();

      // In batch mode, automatically restart camera
      if (batchMode) {
        setTimeout(() => startCamera(), 500);
      }
    } catch (error: any) {
      console.error('Erro ao salvar serviço:', error);
      toast.error('Erro ao salvar serviço: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipDocument = () => {
    setShowConfirmDialog(false);
    setExtractedData(null);
    setPreviewImage(null);
    
    if (batchMode) {
      toast.info('Documento pulado. Pronto para o próximo.');
      setTimeout(() => startCamera(), 500);
    }
  };

  const finishBatchMode = () => {
    setBatchMode(false);
    stopCamera();
    if (batchCount > 0) {
      toast.success(`Modo lote finalizado! ${batchCount} documento(s) processado(s).`);
    }
    setBatchCount(0);
  };

  const handleEditField = (field: keyof ExtractedData, value: string | number) => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        [field]: field === 'service_value' ? parseFloat(String(value)) || 0 : value
      });
    }
  };

  const resetScanner = () => {
    setPreviewImage(null);
    setExtractedData(null);
    setShowConfirmDialog(false);
    stopCamera();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Scanner de Documentos
              {batchMode && batchCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {batchCount} escaneado(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="batch-mode" className="text-sm font-normal text-muted-foreground">
                Modo Lote
              </Label>
              <Switch
                id="batch-mode"
                checked={batchMode}
                onCheckedChange={(checked) => {
                  setBatchMode(checked);
                  if (!checked && batchCount > 0) {
                    finishBatchMode();
                  } else {
                    setBatchCount(0);
                  }
                }}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {batchMode && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Modo lote ativo - escaneie múltiplos documentos em sequência
                </span>
              </div>
              {batchCount > 0 && (
                <Button size="sm" variant="outline" onClick={finishBatchMode}>
                  Finalizar ({batchCount})
                </Button>
              )}
            </div>
          )}

          {!showCamera && !previewImage && !isScanning && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={startCamera}
                variant="outline"
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Usar Câmera
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload de Imagem
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={batchMode}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {showCamera && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 pointer-events-none rounded" />
                {batchMode && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/70 text-white">
                      Lote: {batchCount + 1}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={captureImage} className="flex-1">
                  <Camera className="mr-2 h-4 w-4" />
                  Capturar
                </Button>
                <Button onClick={batchMode ? finishBatchMode : stopCamera} variant="outline">
                  {batchMode ? 'Finalizar' : <X className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analisando documento com IA...
              </p>
            </div>
          )}

          {previewImage && !isScanning && !showConfirmDialog && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewImage}
                  alt="Documento escaneado"
                  className="w-full h-full object-contain"
                />
              </div>
              <Button onClick={resetScanner} variant="outline" className="w-full">
                <X className="mr-2 h-4 w-4" />
                Escanear outro documento
              </Button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Confirmar Dados Extraídos
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Verifique e edite os dados antes de adicionar ao relatório:
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="clinic_name">Nome da Clínica</Label>
                <Input
                  id="clinic_name"
                  value={extractedData?.clinic_name || ''}
                  onChange={(e) => handleEditField('clinic_name', e.target.value)}
                  placeholder="Nome da clínica"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_name">Nome do Paciente</Label>
                <Input
                  id="patient_name"
                  value={extractedData?.patient_name || ''}
                  onChange={(e) => handleEditField('patient_name', e.target.value)}
                  placeholder="Nome do paciente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_name">Trabalho a Executar</Label>
                <Input
                  id="service_name"
                  value={extractedData?.service_name || ''}
                  onChange={(e) => handleEditField('service_name', e.target.value)}
                  placeholder="Tipo de serviço"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_value">Valor (R$)</Label>
                <Input
                  id="service_value"
                  type="number"
                  step="0.01"
                  value={extractedData?.service_value || ''}
                  onChange={(e) => handleEditField('service_value', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {batchMode && (
              <Button
                variant="ghost"
                onClick={handleSkipDocument}
                disabled={isSaving}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Pular
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                if (batchMode) {
                  finishBatchMode();
                } else {
                  resetScanner();
                }
              }}
            >
              {batchMode ? 'Finalizar Lote' : 'Cancelar'}
            </Button>
            <Button
              onClick={handleConfirmData}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {batchMode ? 'Adicionar e Próximo' : 'Adicionar ao Relatório'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
