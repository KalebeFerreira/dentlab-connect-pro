import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, Scan, Loader2, X, Check, FileImage, FileText, File } from "lucide-react";
import { format } from "date-fns";

interface ExtractedData {
  clinic_name: string | null;
  patient_name: string | null;
  service_name: string | null;
  service_value: number | null;
  color?: string | null;
  work_type?: string | null;
}

interface EmployeeDocumentScannerProps {
  ownerUserId: string;
  employeeId: string;
  employeeName: string;
  onScanComplete?: () => void;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const WORK_COLORS = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
  "BL1", "BL2", "BL3", "BL4",
];

export const EmployeeDocumentScanner = ({ ownerUserId, employeeId, employeeName, onScanComplete }: EmployeeDocumentScannerProps) => {
  const isMobile = useIsMobile();
  const [isScanning, setIsScanning] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; type: string } | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFileData, setCurrentFileData] = useState<string | null>(null);

  // Editable form fields
  const [workType, setWorkType] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [workColor, setWorkColor] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (dataUrl: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isDoc = SUPPORTED_DOC_TYPES.includes(file.type);

    if (!isImage && !isDoc) {
      toast.error('Tipo de arquivo não suportado. Use: JPG, PNG ou PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      let fileData = e.target?.result as string;
      if (isImage) {
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
    setIsScanning(true);
    try {
      const isImageType = SUPPORTED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/') || fileData.startsWith('data:image/');

      if (isImageType) {
        const { data, error } = await supabase.functions.invoke('scan-document', {
          body: { imageBase64: fileData }
        });

        if (error) throw new Error(error.message || 'Erro ao processar imagem');

        if (data?.data) {
          const d = data.data;
          setExtractedData(d);
          setWorkType(d.work_type || d.service_name || "");
          setServiceName(d.service_name || "");
          setServiceValue(d.service_value ? `R$ ${Number(d.service_value).toFixed(2).replace('.', ',')}` : "");
          setClientName(d.clinic_name || "");
          setPatientName(d.patient_name || "");
          setWorkColor(d.color || "");
          setShowConfirmDialog(true);
          toast.success('Dados extraídos com sucesso!');
        } else {
          setEmptyForm();
          setShowConfirmDialog(true);
          toast.info('Preencha os dados manualmente');
        }
      } else {
        setEmptyForm();
        setShowConfirmDialog(true);
        toast.info('Documento carregado. Preencha os dados manualmente.');
      }
    } catch (error: any) {
      console.error('Erro ao processar documento:', error);
      setEmptyForm();
      setShowConfirmDialog(true);
      toast.error('Erro ao processar. Preencha manualmente.');
    } finally {
      setIsScanning(false);
    }
  };

  const setEmptyForm = () => {
    setExtractedData({ clinic_name: null, patient_name: null, service_name: null, service_value: null });
    setWorkType("");
    setServiceName("");
    setServiceValue("");
    setClientName("");
    setPatientName("");
    setWorkColor("");
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handleConfirmData = async () => {
    setIsSaving(true);
    try {
      const numericValue = parseFloat(
        serviceValue.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
      );

      if (!workType.trim()) {
        toast.error("Preencha o tipo de trabalho");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from("work_records").insert([{
        user_id: ownerUserId,
        employee_id: employeeId,
        work_type: workType.trim(),
        start_date: startDate,
        end_date: endDate || null,
        status: endDate ? "finished" : "in_progress",
        value: isNaN(numericValue) ? 0 : numericValue,
        patient_name: patientName.trim() || null,
        color: workColor || null,
        notes: `Dentista: ${dentistName || "-"} | Cliente: ${clientName || "-"} | Via scanner por ${employeeName}`,
      }]);

      if (error) throw error;

      toast.success("Trabalho registrado via scanner!", {
        description: `Registrado por ${employeeName}`,
      });

      resetAll();
      onScanComplete?.();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar trabalho", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const resetAll = () => {
    setShowConfirmDialog(false);
    setPreviewImage(null);
    setPreviewFile(null);
    setCurrentFileData(null);
    setExtractedData(null);
    setWorkType("");
    setServiceName("");
    setServiceValue("");
    setClientName("");
    setPatientName("");
    setDentistName("");
    setWorkColor("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scanner de Documentos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escaneie documentos para registrar trabalhos automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isScanning && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando documento com IA...</p>
            </div>
          )}

          {!isScanning && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Camera capture */}
              <div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm">Tirar Foto</span>
                </Button>
              </div>

              {/* File upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">Enviar Arquivo</span>
                </Button>
              </div>
            </div>
          )}

          {previewImage && !isScanning && (
            <div className="relative">
              <img src={previewImage} alt="Preview" className="w-full max-h-48 object-contain rounded-lg border" />
            </div>
          )}
          {previewFile && !previewImage && !isScanning && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <span className="text-sm truncate">{previewFile.name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) resetAll(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Dados do Trabalho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tipo de Trabalho *</Label>
              <Input value={workType} onChange={(e) => setWorkType(e.target.value)} placeholder="Ex: Coroa, Prótese..." />
            </div>
            <div className="space-y-1">
              <Label>Valor (Comissão)</Label>
              <Input value={serviceValue} onChange={(e) => setServiceValue(formatCurrency(e.target.value))} placeholder="R$ 0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Clínica" />
              </div>
              <div className="space-y-1">
                <Label>Dentista</Label>
                <Input value={dentistName} onChange={(e) => setDentistName(e.target.value)} placeholder="Dentista" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Paciente</Label>
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome do paciente" />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <Select value={workColor} onValueChange={setWorkColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cor" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Entrada</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Finalização</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetAll} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleConfirmData} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
