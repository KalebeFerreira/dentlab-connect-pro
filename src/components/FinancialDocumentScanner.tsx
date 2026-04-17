import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Copy,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isPdfFile, renderPdfFirstPageToImage } from "@/lib/pdfToImage";

interface ExtractedFinancialData {
  transaction_type: 'receipt' | 'payment' | null;
  amount: number | null;
  description: string | null;
  vendor_name: string | null;
  document_number: string | null;
  date: string | null;
  category: string | null;
  raw_text?: string | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  classification_reason?: string | null;
}

const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materiais' },
  { value: 'fixed_costs', label: 'Contas Fixas' },
  { value: 'suppliers', label: 'Fornecedores' },
  { value: 'services', label: 'Serviços' },
  { value: 'salaries', label: 'Salários' },
  { value: 'taxes', label: 'Impostos' },
  { value: 'other', label: 'Outros' },
];

interface FinancialDocumentScannerProps {
  onTransactionAdd: () => void;
  onScanComplete?: () => void;
  defaultMonth?: number;
  defaultYear?: number;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALL_SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOC_TYPES];

export const FinancialDocumentScanner = ({
  onTransactionAdd,
  onScanComplete,
  defaultMonth = new Date().getMonth() + 1,
  defaultYear = new Date().getFullYear()
}: FinancialDocumentScannerProps) => {
  const isMobile = useIsMobile();
  const scannerLimits = useScannerLimits();
  const [isScanning, setIsScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{name: string, type: string} | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedFinancialData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFileData, setCurrentFileData] = useState<string | null>(null);

  const [formMonth, setFormMonth] = useState(defaultMonth);
  const [formYear, setFormYear] = useState(defaultYear);
  const [formStatus, setFormStatus] = useState<'pending' | 'completed'>('completed');
  const [formCategory, setFormCategory] = useState<string>('');

  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showCameraHelp, setShowCameraHelp] = useState(false);

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
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch {
          }
        };
      }
      setShowCamera(true);
    } catch (error: any) {
      console.error('Erro ao acessar câmera:', error);
      const name = error?.name || '';
      let msg = 'Não foi possível abrir a câmera.';

      if (name === 'NotAllowedError') {
        setCameraError('permission');
        msg = 'Permissão de câmera negada.';
      } else if (name === 'NotFoundError') {
        msg = 'Nenhuma câmera encontrada.';
      }

      toast.error(msg, {
        action: name === 'NotAllowedError' ? {
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

  const compressImage = (dataUrl: string, maxWidth = 800, quality = 0.5): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        const compressedData = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedData);
      };
      img.onerror = () => resolve(dataUrl);
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

  const getFileIcon = (type: string) => {
    if (SUPPORTED_IMAGE_TYPES.includes(type)) {
      return <FileImage className="h-12 w-12 text-blue-500" />;
    }
    if (type.includes('pdf')) {
      return <FileText className="h-12 w-12 text-red-500" />;
    }
    return <File className="h-12 w-12 text-muted-foreground" />;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isDoc = SUPPORTED_DOC_TYPES.includes(file.type);

    if (!isImage && !isDoc) {
      toast.error(`Tipo de arquivo não suportado. Use: JPG, PNG ou PDF`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const originalFileData = e.target?.result as string;
      let fileData = originalFileData;

      if (isImage) {
        toast.info('Otimizando imagem para envio...');
        fileData = await compressImage(fileData);
        setPreviewImage(fileData);
      } else if (isPdfFile(file.type, originalFileData)) {
        toast.info('Preparando PDF para análise...');
        fileData = await renderPdfFirstPageToImage(originalFileData, { maxWidth: 1600, quality: 0.92 });
        setPreviewImage(fileData);
      } else {
        setPreviewImage(null);
      }

      setCurrentFileData(fileData);
      setPreviewFile({ name: file.name, type: file.type });

      processFile(fileData, fileData.startsWith('data:image/') ? 'image/jpeg' : file.type);
    };
    reader.readAsDataURL(file);
  };

  const processFile = async (fileData: string, fileType: string) => {
    if (!scannerLimits.checkAndWarn()) return;

    setIsScanning(true);
    try {
      const isImageType = SUPPORTED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/') || fileData.startsWith('data:image/');

      if (isImageType) {
        const { data, error } = await supabase.functions.invoke('scan-financial-document', {
          body: { imageBase64: fileData }
        });

        if (error) throw error;

        if (data?.data) {
          await scannerLimits.incrementUsage();
          const confidence = data.confidence || 'medium';
          const isUnsure = confidence !== 'high';

          setExtractedData({
            ...data.data,
            transaction_type: isUnsure ? null : data.data.transaction_type,
            raw_text: data.raw_text || data.data.raw_text || null,
            confidence: confidence,
            classification_reason: data.classification_reason || null,
          });
          setShowConfirmDialog(true);

          if (isUnsure) {
            toast.warning('⚠️ A IA não tem certeza! Escolha se é RECEITA ou DESPESA.', {
              duration: 5000,
            });
          } else if (data.success) {
            toast.success('Dados extraídos com sucesso!');
          } else {
            toast.info('Preencha ou corrija os dados manualmente');
          }
        } else {
          throw new Error(data?.error || 'Erro ao processar imagem');
        }
      } else {
        setExtractedData({
          transaction_type: null,
          amount: null,
          description: null,
          vendor_name: null,
          document_number: null,
          date: null,
          category: null
        });
        setShowConfirmDialog(true);
        toast.info('Documento carregado. Preencha os dados manualmente.');
      }
    } catch (error: any) {
      console.error('Erro ao processar documento:', error);
      toast.error('Erro ao processar: ' + (error.message || 'Tente novamente'));
      setExtractedData({
        transaction_type: null,
        amount: null,
        description: null,
        vendor_name: null,
        document_number: null,
        date: null,
        category: null,
        raw_text: 'Erro ao processar - preencha manualmente'
      });
      setShowConfirmDialog(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmData = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const vendorName = extractedData.vendor_name || extractedData.description || 'Transação escaneada';
      
      // Check if there's an existing transaction with same vendor in same month/year
      // to suggest client matching
      const { data: existingTransactions } = await supabase
        .from('financial_transactions')
        .select('description')
        .eq('user_id', user.id)
        .eq('month', formMonth)
        .eq('year', formYear)
        .ilike('description', `%${vendorName.split(' ')[0]}%`)
        .limit(1);

      // Use existing description format if found
      const finalDescription = existingTransactions && existingTransactions.length > 0
        ? existingTransactions[0].description
        : vendorName;

      // Insert financial transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          transaction_type: extractedData.transaction_type || 'payment',
          amount: extractedData.amount || 0,
          description: finalDescription,
          status: formStatus,
          month: formMonth,
          year: formYear,
          category: extractedData.transaction_type === 'payment' ? (formCategory || extractedData.category) : null
        })
        .select('id')
        .single();

      if (transactionError) throw transactionError;

      // Save scanned document to history if we have image data
      if (currentFileData && previewImage) {
        try {
          // Upload image to storage
          const fileName = `${user.id}/${Date.now()}_financial.jpg`;
          const base64Data = currentFileData.split(',')[1];
          const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('scanned-documents')
            .upload(fileName, byteArray, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage
              .from('scanned-documents')
              .getPublicUrl(uploadData.path);

            // Save to financial_scanned_documents history
            await supabase
              .from('financial_scanned_documents' as any)
              .insert({
                user_id: user.id,
                image_url: publicUrl.publicUrl,
                file_name: previewFile?.name || 'documento_escaneado.jpg',
                file_type: previewFile?.type || 'image/jpeg',
                transaction_type: extractedData.transaction_type || 'payment',
                amount: extractedData.amount || 0,
                description: finalDescription,
                vendor_name: extractedData.vendor_name,
                document_number: extractedData.document_number,
                document_date: extractedData.date,
                transaction_id: transactionData?.id,
                category: extractedData.transaction_type === 'payment' ? (formCategory || extractedData.category) : null
              });
          }
        } catch (historyError) {
          console.error('Erro ao salvar histórico:', historyError);
          // Don't fail the whole operation if history save fails
        }
      }

      // Update batch count
      if (batchMode) {
        setBatchCount(prev => prev + 1);
        toast.success(`Transação ${batchCount + 1} adicionada! Pronto para a próxima.`);
      } else {
        toast.success('Transação adicionada com sucesso!');
      }
      
      setShowConfirmDialog(false);
      setExtractedData(null);
      setPreviewImage(null);
      setPreviewFile(null);
      setCurrentFileData(null);
      onTransactionAdd();
      onScanComplete?.();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (batchMode) {
        if (isMobile) {
          toast.info('Pronto! Toque em "Usar Câmera" para a próxima.');
        } else {
          setTimeout(() => startCamera(), 500);
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      toast.error('Erro ao salvar: ' + error.message);
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
      toast.success(`Modo lote finalizado! ${batchCount} transação(ões) processada(s).`);
    }
    setBatchCount(0);
  };

  const handleEditField = (field: keyof ExtractedFinancialData, value: string | number) => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        [field]: field === 'amount' ? parseFloat(String(value)) || 0 : value
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
              <span className="text-base sm:text-lg">Scanner Financeiro</span>
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
              {isMobile ? (
                <label
                  htmlFor="camera-input-financial"
                  className="flex items-center justify-center w-full h-14 text-base rounded-md border border-input bg-background px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Usar Câmera
                  <input
                    id="camera-input-financial"
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
                  Suporta: JPG, PNG, PDF (máx. 10MB)
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
              
              {cameraError === 'permission' && (
                <Alert className="bg-amber-50 border-amber-200">
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
                Analisando documento financeiro com IA...
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
              Dados Financeiros Extraídos
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {previewImage && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={previewImage}
                  alt="Documento escaneado"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            
            {extractedData?.raw_text && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Texto Capturado</span>
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
                <div className="max-h-24 overflow-y-auto">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                    {extractedData.raw_text}
                  </p>
                </div>
              </div>
            )}

            <Alert className={`border-2 ${
              !extractedData?.transaction_type
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                : extractedData?.transaction_type === 'receipt' 
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
                  : 'border-red-500 bg-red-50 dark:bg-red-950/30'
            }`}>
              <AlertDescription>
                <div className="flex flex-col gap-3">
                  {!extractedData?.transaction_type ? (
                    <>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                        <span className="text-base font-bold text-amber-800 dark:text-amber-200">
                          🚨 Escolha o tipo da transação!
                        </span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                        A IA não conseguiu identificar com certeza se é receita ou despesa.
                        {extractedData?.classification_reason && (
                          <span className="block mt-1 text-xs font-normal italic">
                            Observação da IA: "{extractedData.classification_reason}"
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground">
                          Confira o tipo antes de salvar
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A IA sugeriu: <strong>{extractedData.transaction_type === 'receipt' ? 'RECEITA' : 'DESPESA'}</strong>
                        {extractedData.confidence && extractedData.confidence !== 'high' && ' (confiança baixa)'}. 
                        Se estiver errado, clique no botão correto.
                        {extractedData?.classification_reason && (
                          <span className="block mt-1 italic">
                            Motivo: "{extractedData.classification_reason}"
                          </span>
                        )}
                      </p>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={extractedData?.transaction_type === 'payment' ? 'default' : 'outline'}
                      className={`h-14 text-sm font-bold ${
                        extractedData?.transaction_type === 'payment' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'border-red-400 text-red-700 hover:bg-red-100 dark:hover:bg-red-950'
                      }`}
                      onClick={() => handleEditField('transaction_type', 'payment')}
                    >
                      <TrendingDown className="mr-2 h-5 w-5" />
                      DESPESA
                    </Button>
                    <Button
                      type="button"
                      variant={extractedData?.transaction_type === 'receipt' ? 'default' : 'outline'}
                      className={`h-14 text-sm font-bold ${
                        extractedData?.transaction_type === 'receipt' 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'border-green-400 text-green-700 hover:bg-green-100 dark:hover:bg-green-950'
                      }`}
                      onClick={() => handleEditField('transaction_type', 'receipt')}
                    >
                      <TrendingUp className="mr-2 h-5 w-5" />
                      RECEITA
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Valor Identificado</span>
              </div>
              <div className="p-2 bg-background rounded border">
                <span className="text-muted-foreground block text-xs">Valor:</span>
                <span className="font-medium text-lg">
                  {extractedData?.amount ? `R$ ${extractedData.amount.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Edite os campos abaixo se necessário:
            </p>
            
            <div className="space-y-3">

              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-sm">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={extractedData?.amount || ''}
                  onChange={(e) => handleEditField('amount', e.target.value)}
                  placeholder="0.00"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm">Descrição</Label>
                <Input
                  id="description"
                  value={extractedData?.description || ''}
                  onChange={(e) => handleEditField('description', e.target.value)}
                  placeholder="Descrição da transação"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Mês</Label>
                  <Select
                    value={formMonth.toString()}
                    onValueChange={(value) => setFormMonth(parseInt(value))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(12)].map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Ano</Label>
                  <Select
                    value={formYear.toString()}
                    onValueChange={(value) => setFormYear(parseInt(value))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(value) => setFormStatus(value as 'pending' | 'completed')}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Confirmado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {extractedData?.transaction_type === 'payment' && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Categoria da Despesa</Label>
                  <Select
                    value={formCategory || extractedData?.category || ''}
                    onValueChange={(value) => setFormCategory(value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              disabled={isSaving || !extractedData?.transaction_type}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {batchMode ? 'Adicionar e Próximo' : 'Adicionar Transação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera help dialog */}
      <Dialog open={showCameraHelp} onOpenChange={setShowCameraHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Como liberar a câmera
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <Alert>
              <AlertDescription>
                A permissão de câmera pode estar bloqueada. Verifique as configurações do seu navegador.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">iPhone / Safari</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Abra Ajustes {">"} Safari {">"} Câmera</li>
                <li>Selecione "Permitir"</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Android / Chrome</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Toque no cadeado na barra de endereço</li>
                <li>Permissões {">"} Câmera {">"} Permitir</li>
              </ol>
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
