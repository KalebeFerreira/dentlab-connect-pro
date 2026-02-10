import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useScannerLimits } from "@/hooks/useScannerLimits";
import { FreemiumBanner } from "@/components/FreemiumBanner";
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
  File,
  HelpCircle,
  Smartphone,
  Settings,
  RefreshCw,
  Copy
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";

interface ExtractedData {
  clinic_name: string | null;
  patient_name: string | null;
  service_name: string | null;
  service_value: number | null;
  color?: string | null;
  work_type?: string | null;
  raw_text?: string | null;
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
  const isMobile = useIsMobile();
  const scannerLimits = useScannerLimits();
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
  
  // Camera help dialog
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      let errorType = 'unknown';
      let msg = 'Não foi possível abrir a câmera neste aparelho.';
      
      if (name === 'NotAllowedError') {
        errorType = 'permission';
        msg = 'Permissão de câmera negada.';
      } else if (name === 'NotFoundError') {
        errorType = 'notfound';
        msg = 'Nenhuma câmera encontrada neste dispositivo.';
      } else if (name === 'OverconstrainedError') {
        errorType = 'overconstrained';
        msg = 'Câmera não suportou a resolução solicitada.';
      }

      setCameraError(errorType);
      toast.error(msg, {
        action: errorType === 'permission' ? {
          label: 'Ver ajuda',
          onClick: () => setShowCameraHelp(true)
        } : undefined
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  // Compressão de imagem para redes lentas (4G/3G)
  const compressImage = (dataUrl: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar se maior que maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Aplicar suavização para melhor qualidade
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Converter para JPEG com qualidade reduzida
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        
        // Log do tamanho para debug
        const originalSize = Math.round(dataUrl.length / 1024);
        const compressedSize = Math.round(compressedData.length / 1024);
        console.log(`Imagem comprimida: ${originalSize}KB → ${compressedSize}KB (${Math.round((1 - compressedSize/originalSize) * 100)}% menor)`);
        
        resolve(compressedData);
      };
      img.onerror = () => resolve(dataUrl); // Fallback para original se falhar
      img.src = dataUrl;
    });
  };

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const rawImage = canvas.toDataURL('image/jpeg', 0.9);
        
        // Comprimir antes de processar
        toast.info('Otimizando imagem...');
        const compressedImage = await compressImage(rawImage);
        
        setPreviewImage(compressedImage);
        setPreviewFile({ name: 'captured_photo.jpg', type: 'image/jpeg' });
        setCurrentFileData(compressedImage);
        stopCamera();
        processFile(compressedImage, 'image/jpeg');
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type - ser mais flexível com imagens
    const isImage = file.type.startsWith('image/') || SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isDoc = SUPPORTED_DOC_TYPES.includes(file.type);
    
    if (!isImage && !isDoc) {
      toast.error(`Tipo de arquivo não suportado. Use: JPG, PNG, PDF, Word ou Excel`);
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      let fileData = e.target?.result as string;
      
      // Comprimir imagens automaticamente para redes lentas
      if (isImage) {
        toast.info('Otimizando imagem para envio...');
        fileData = await compressImage(fileData);
        setPreviewImage(fileData);
      } else {
        setPreviewImage(null);
      }
      
      setCurrentFileData(fileData);
      setPreviewFile({ name: file.name, type: file.type });
      
      processFile(fileData, isImage ? 'image/jpeg' : file.type);
    };
    reader.readAsDataURL(file);
  };

  const processFile = async (fileData: string, fileType: string) => {
    // Check scanner limits before processing
    if (!scannerLimits.checkAndWarn()) return;
    
    setIsScanning(true);
    try {
      // Detect if it's an image (check both type and data URL)
      const isImageType = SUPPORTED_IMAGE_TYPES.includes(fileType) || 
                          fileType.startsWith('image/') ||
                          fileData.startsWith('data:image/');
      
      // For images, use the AI scanner
      if (isImageType) {
        console.log('Enviando imagem para scan-document...', { fileType, dataLength: fileData.length });
        
        const { data, error } = await supabase.functions.invoke('scan-document', {
          body: { imageBase64: fileData }
        });

        console.log('Resposta do scan-document:', { data, error });

        if (error) {
          console.error('Erro da edge function:', error);
          throw new Error(error.message || 'Erro ao processar imagem');
        }

        if (data?.data) {
          await scannerLimits.incrementUsage();
          setExtractedData({
            ...data.data,
            raw_text: data.raw_text || data.data.raw_text || null
          });
          setShowConfirmDialog(true);
          if (data.success) {
            toast.success('Dados extraídos com sucesso!');
          } else {
            toast.info('Preencha ou corrija os dados manualmente');
          }
        } else if (data?.error) {
          // API returned an error but with status 200
          console.error('Erro retornado pela API:', data.error);
          toast.error('Erro: ' + data.error);
          // Still show dialog for manual entry
          setExtractedData({
            clinic_name: null,
            patient_name: null,
            service_name: null,
            service_value: null,
            raw_text: 'Erro ao processar - preencha manualmente'
          });
          setShowConfirmDialog(true);
        } else {
          throw new Error('Resposta inválida do servidor');
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
      toast.error('Erro ao processar: ' + (error.message || 'Tente novamente'));
      // Show dialog for manual entry even on error
      setExtractedData({
        clinic_name: null,
        patient_name: null,
        service_name: null,
        service_value: null,
        raw_text: 'Erro ao processar - preencha manualmente'
      });
      setShowConfirmDialog(true);
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

      // Check if client already exists with similar name to avoid duplicates
      let finalClientName = extractedData.clinic_name;
      
      if (extractedData.clinic_name) {
        // Search for existing clients with similar name (case-insensitive)
        const searchName = extractedData.clinic_name.trim();
        const firstWord = searchName.split(' ')[0];
        
        const { data: existingClients } = await supabase
          .from('services')
          .select('client_name')
          .eq('user_id', user.id)
          .not('client_name', 'is', null)
          .ilike('client_name', `%${firstWord}%`)
          .limit(10);

        if (existingClients && existingClients.length > 0) {
          // Find exact or closest match
          const normalizedInput = searchName.toLowerCase().trim();
          
          // First try exact match
          const exactMatch = existingClients.find(
            c => c.client_name?.toLowerCase().trim() === normalizedInput
          );
          
          if (exactMatch) {
            finalClientName = exactMatch.client_name;
            console.log(`Cliente existente encontrado (match exato): ${finalClientName}`);
          } else {
            // Try to find a very similar match (contains full name or vice versa)
            const similarMatch = existingClients.find(c => {
              const existingName = c.client_name?.toLowerCase().trim() || '';
              return existingName.includes(normalizedInput) || normalizedInput.includes(existingName);
            });
            
            if (similarMatch) {
              finalClientName = similarMatch.client_name;
              console.log(`Cliente existente encontrado (match similar): ${finalClientName}`);
            }
          }
        }
      }

      // Insert service with deduplicated client name
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
          service_name: extractedData.service_name || 'Serviço escaneado',
          service_value: extractedData.service_value || 0,
          client_name: finalClientName,
          patient_name: extractedData.patient_name,
          color: extractedData.color || null,
          work_type: extractedData.work_type || extractedData.service_name || null,
          service_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      // Save scan history with file and deduplicated client name
      if (fileUrl) {
        const { error: historyError } = await supabase
          .from('scanned_documents')
          .insert({
            user_id: user.id,
            image_url: fileUrl,
            clinic_name: finalClientName,
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

      // In batch mode, no mobile o usuário precisa tocar novamente (o navegador pode bloquear abertura automática da câmera)
      if (batchMode) {
        if (isMobile) {
          toast.info('Pronto! Toque em "Usar Câmera" para o próximo documento.');
        } else {
          setTimeout(() => startCamera(), 500);
        }
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
      if (!isMobile) {
        setTimeout(() => startCamera(), 500);
      }
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
      {scannerLimits.limit !== -1 && (
        <FreemiumBanner feature="scans" currentUsage={scannerLimits.currentUsage} limit={scannerLimits.limit} percentage={scannerLimits.percentage} />
      )}
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
              {/* Mobile: usar label nativo (mais confiável em iOS/Android) */}
              {isMobile ? (
                <label
                  htmlFor="camera-input-mobile"
                  className="flex items-center justify-center w-full h-14 text-base rounded-md border border-input bg-background px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Usar Câmera
                  <input
                    id="camera-input-mobile"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              ) : (
                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="w-full h-14 text-base"
                  size="lg"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Usar Câmera
                </Button>
              )}
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full h-14 text-base"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload de Arquivo
              </Button>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Suporta: JPG, PNG, PDF, Word, Excel (máx. 10MB)
                </p>
                <button
                  type="button"
                  onClick={() => setShowCameraHelp(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="h-3 w-3" />
                  Ajuda
                </button>
              </div>
              
              {/* Aviso se houve erro de câmera */}
              {cameraError === 'permission' && (
                <Alert className="bg-amber-50 border-amber-200">
                  <Settings className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    Câmera bloqueada. 
                    <button 
                      onClick={() => setShowCameraHelp(true)}
                      className="ml-1 underline font-medium"
                    >
                      Veja como liberar
                    </button>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Upload geral (imagens + docs) */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes}
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
            
            {/* Preview do texto bruto capturado */}
            {extractedData?.raw_text && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Texto Capturado da Imagem</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (extractedData?.raw_text) {
                        navigator.clipboard.writeText(extractedData.raw_text);
                        toast.success("Texto copiado!");
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                    {extractedData.raw_text}
                  </p>
                </div>
              </div>
            )}

            {/* Preview do texto extraído */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Dados Identificados pela IA</span>
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
                <ClientAutocomplete
                  id="clinic_name"
                  value={extractedData?.clinic_name || ''}
                  onChange={(value) => handleEditField('clinic_name', value)}
                  placeholder="Digite ou selecione um cliente"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="color" className="text-sm">Cor</Label>
                  <Input
                    id="color"
                    value={extractedData?.color || ''}
                    onChange={(e) => handleEditField('color', e.target.value)}
                    placeholder="Ex: A2, B1, Bleach"
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

      {/* Diálogo de ajuda para permissão de câmera */}
      <Dialog open={showCameraHelp} onOpenChange={setShowCameraHelp}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Como liberar a câmera
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                A permissão de câmera pode estar bloqueada. Siga os passos abaixo para seu dispositivo:
              </AlertDescription>
            </Alert>

            {/* Vídeo Tutorial */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                🎬 Vídeo Tutorial
              </h4>
              <div className="aspect-video rounded-lg overflow-hidden bg-muted border">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/f7l5CeWX3GE?rel=0"
                  title="Como liberar permissão de câmera no celular"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Vídeo mostrando como liberar permissões no navegador
              </p>
            </div>

            {/* iPhone / Safari */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                🍎 iPhone / Safari
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Abra <strong>Ajustes</strong> do iPhone</li>
                <li>Role até <strong>Safari</strong></li>
                <li>Toque em <strong>Câmera</strong></li>
                <li>Selecione <strong>Permitir</strong></li>
                <li>Volte ao app e toque em "Usar Câmera" novamente</li>
              </ol>
            </div>

            {/* Android / Chrome */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                🤖 Android / Chrome
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Toque no <strong>cadeado 🔒</strong> na barra de endereço</li>
                <li>Toque em <strong>Permissões</strong> ou <strong>Configurações do site</strong></li>
                <li>Encontre <strong>Câmera</strong> e altere para <strong>Permitir</strong></li>
                <li>Recarregue a página e tente novamente</li>
              </ol>
            </div>

            {/* Android / Samsung Internet */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                📱 Samsung Internet
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Toque no menu <strong>≡</strong> → <strong>Configurações</strong></li>
                <li>Vá em <strong>Sites e downloads</strong> → <strong>Permissões do site</strong></li>
                <li>Toque em <strong>Câmera</strong> e permita para este site</li>
              </ol>
            </div>

            {/* Dica alternativa */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <strong>Dica:</strong> Se a câmera ao vivo não funcionar, use o botão <strong>"Usar Câmera"</strong> que abre o app de câmera do seu celular diretamente.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowCameraHelp(false)} className="w-full">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
