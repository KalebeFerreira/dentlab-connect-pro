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
  SkipForward,
  FileText,
  File
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

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const ALL_SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOC_TYPES];

export const DocumentScanner = ({ onServiceAdd, onScanComplete }: DocumentScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{name: string, type: string} | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFileData, setCurrentFileData] = useState<string | null>(null);
  
  // Batch mode states
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia não suportado');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS/Safari às vezes precisa disso para iniciar o vídeo
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch {
            // ignore
          }
        };
      }
      setShowCamera(true);
    } catch (error: any) {
      console.error('Erro ao acessar câmera:', error);

      const name = error?.name || '';
      const msg =
        name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Ative nas configurações do navegador.'
          : name === 'NotFoundError'
            ? 'Nenhuma câmera encontrada neste dispositivo.'
            : name === 'OverconstrainedError'
              ? 'Câmera não suportou a resolução solicitada.'
              : 'Não foi possível abrir a câmera. Vou usar o modo alternativo.';

      toast.error(msg);

      // Fallback universal: usar input capture (abre a câmera no celular)
      setTimeout(() => cameraInputRef.current?.click(), 150);
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
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewImage(imageData);
        setPreviewFile({ name: 'captured_photo.jpg', type: 'image/jpeg' });
        setCurrentFileData(imageData);
        stopCamera();
        processFile(imageData, 'image/jpeg');
      }
    }
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getFileIcon = (type: string) => {
    if (SUPPORTED_IMAGE_TYPES.includes(type)) {
      return <FileImage className="h-12 w-12 text-blue-500" />;
    }
    if (type.includes('pdf')) {
      return <FileText className="h-12 w-12 text-red-500" />;
    }
    if (type.includes('word') || type.includes('document')) {
      return <FileText className="h-12 w-12 text-blue-600" />;
    }
    if (type.includes('excel') || type.includes('sheet')) {
      return <FileText className="h-12 w-12 text-green-600" />;
    }
    return <File className="h-12 w-12 text-muted-foreground" />;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!ALL_SUPPORTED_TYPES.includes(file.type)) {
      toast.error(`Tipo de arquivo não suportado. Use: JPG, PNG, PDF, Word ou Excel`);
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      setCurrentFileData(fileData);
      setPreviewFile({ name: file.name, type: file.type });
      
      if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        setPreviewImage(fileData);
      } else {
        setPreviewImage(null);
      }
      
      processFile(fileData, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processFile = async (fileData: string, fileType: string) => {
    setIsScanning(true);
    try {
      // For images, use the AI scanner
      if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
        const { data, error } = await supabase.functions.invoke('scan-document', {
          body: { imageBase64: fileData }
        });

        if (error) throw error;

        if (data?.success && data?.data) {
          setExtractedData(data.data);
          setShowConfirmDialog(true);
          toast.success('Dados extraídos com sucesso!');
        } else {
          throw new Error(data?.error || 'Erro ao processar imagem');
        }
      } else {
        // For documents (PDF, Word, Excel), show form for manual entry
        setExtractedData({
          clinic_name: null,
          patient_name: null,
          service_name: null,
          service_value: null
        });
        setShowConfirmDialog(true);
        toast.info('Documento carregado. Preencha os dados manualmente.');
      }
    } catch (error: any) {
      console.error('Erro ao processar documento:', error);
      toast.error('Erro ao processar documento: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsScanning(false);
    }
  };

  const uploadFileToStorage = async (userId: string, fileData: string, fileType: string, fileName: string): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const base64Data = fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType });

      const extension = getFileExtension(fileName) || 'jpg';
      const storedFileName = `${userId}/${Date.now()}.${extension}`;
      
      const { error: uploadError } = await supabase.storage
        .from('scanned-documents')
        .upload(storedFileName, blob, {
          contentType: fileType,
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('scanned-documents')
        .getPublicUrl(storedFileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      return null;
    }
  };

  const handleConfirmData = async () => {
    if (!extractedData || !currentFileData || !previewFile) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Upload file to storage
      const fileUrl = await uploadFileToStorage(user.id, currentFileData, previewFile.type, previewFile.name);

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

      // Save scan history with file
      if (fileUrl) {
        const { error: historyError } = await supabase
          .from('scanned_documents')
          .insert({
            user_id: user.id,
            image_url: fileUrl,
            clinic_name: extractedData.clinic_name,
            patient_name: extractedData.patient_name,
            service_name: extractedData.service_name,
            service_value: extractedData.service_value,
            service_id: serviceData?.id,
            file_type: previewFile.type,
            file_name: previewFile.name
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
      setPreviewFile(null);
      setCurrentFileData(null);
      onServiceAdd();
      onScanComplete?.();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

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
    setPreviewFile(null);
    setCurrentFileData(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
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
    setPreviewFile(null);
    setExtractedData(null);
    setCurrentFileData(null);
    setShowConfirmDialog(false);
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const acceptedFileTypes = ALL_SUPPORTED_TYPES.join(',');

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              <span className="text-base sm:text-lg">Scanner de Documentos</span>
              {batchMode && batchCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {batchCount} escaneado(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="batch-mode" className="text-xs sm:text-sm font-normal text-muted-foreground">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">
                  Modo lote ativo - escaneie múltiplos documentos
                </span>
              </div>
              {batchCount > 0 && (
                <Button size="sm" variant="outline" onClick={finishBatchMode} className="w-full sm:w-auto">
                  Finalizar ({batchCount})
                </Button>
              )}
            </div>
          )}

          {!showCamera && !previewImage && !previewFile && !isScanning && (
            <div className="flex flex-col gap-3">
              <Button
                onClick={startCamera}
                variant="outline"
                className="w-full h-14 text-base"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Usar Câmera
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full h-14 text-base"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload de Arquivo
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Suporta: JPG, PNG, PDF, Word, Excel (máx. 10MB)
              </p>
              {/* Upload geral (imagens + docs) */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes}
                multiple={false}
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Fallback universal de câmera (mobile) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple={false}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {showCamera && (
            <div className="space-y-3">
              <div className="relative aspect-[4/3] sm:aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-dashed border-white/50 m-4 sm:m-8 pointer-events-none rounded" />
                {batchMode && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/70 text-white">
                      Lote: {batchCount + 1}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={captureImage} className="flex-1 h-12 text-base">
                  <Camera className="mr-2 h-5 w-5" />
                  Capturar
                </Button>
                <Button onClick={batchMode ? finishBatchMode : stopCamera} variant="outline" className="h-12 px-4">
                  {batchMode ? 'Finalizar' : <X className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Analisando documento com IA...
              </p>
            </div>
          )}

          {(previewImage || previewFile) && !isScanning && !showConfirmDialog && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Documento escaneado"
                    className="w-full h-full object-contain"
                  />
                ) : previewFile ? (
                  <div className="flex flex-col items-center gap-2 p-4">
                    {getFileIcon(previewFile.type)}
                    <p className="text-sm text-muted-foreground text-center truncate max-w-full px-4">
                      {previewFile.name}
                    </p>
                  </div>
                ) : null}
              </div>
              <Button onClick={resetScanner} variant="outline" className="w-full h-12">
                <X className="mr-2 h-4 w-4" />
                Escanear outro documento
              </Button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Dados Extraídos do Documento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Preview do documento escaneado */}
            {previewImage && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewImage}
                  alt="Documento escaneado"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {/* Preview do texto extraído */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Texto Extraído pela IA</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-background rounded border">
                  <span className="text-muted-foreground block">Clínica:</span>
                  <span className="font-medium truncate block">{extractedData?.clinic_name || '—'}</span>
                </div>
                <div className="p-2 bg-background rounded border">
                  <span className="text-muted-foreground block">Paciente:</span>
                  <span className="font-medium truncate block">{extractedData?.patient_name || '—'}</span>
                </div>
                <div className="p-2 bg-background rounded border">
                  <span className="text-muted-foreground block">Serviço:</span>
                  <span className="font-medium truncate block">{extractedData?.service_name || '—'}</span>
                </div>
                <div className="p-2 bg-background rounded border">
                  <span className="text-muted-foreground block">Valor:</span>
                  <span className="font-medium text-green-600">
                    {extractedData?.service_value ? `R$ ${extractedData.service_value.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Edite os campos abaixo se necessário:
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="clinic_name" className="text-sm">Nome da Clínica/Cliente</Label>
                <Input
                  id="clinic_name"
                  value={extractedData?.clinic_name || ''}
                  onChange={(e) => handleEditField('clinic_name', e.target.value)}
                  placeholder="Nome da clínica"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patient_name" className="text-sm">Nome do Paciente</Label>
                <Input
                  id="patient_name"
                  value={extractedData?.patient_name || ''}
                  onChange={(e) => handleEditField('patient_name', e.target.value)}
                  placeholder="Nome do paciente"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="service_name" className="text-sm">Trabalho a Executar</Label>
                <Input
                  id="service_name"
                  value={extractedData?.service_name || ''}
                  onChange={(e) => handleEditField('service_name', e.target.value)}
                  placeholder="Tipo de serviço"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="service_value" className="text-sm">Valor (R$)</Label>
                <Input
                  id="service_value"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={extractedData?.service_value || ''}
                  onChange={(e) => handleEditField('service_value', e.target.value)}
                  placeholder="0.00"
                  className="h-11"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {batchMode && (
              <Button
                variant="ghost"
                onClick={handleSkipDocument}
                disabled={isSaving}
                className="w-full sm:w-auto"
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
              className="w-full sm:w-auto"
            >
              {batchMode ? 'Finalizar Lote' : 'Cancelar'}
            </Button>
            <Button
              onClick={handleConfirmData}
              disabled={isSaving}
              className="w-full sm:w-auto"
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
