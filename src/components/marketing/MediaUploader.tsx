import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, FileUp, X, Loader2 } from "lucide-react";

interface MediaUploaderProps {
  campaignId: string;
  userId: string;
  onUploadComplete: () => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  caption: string;
}

export const MediaUploader = ({ campaignId, userId, onUploadComplete }: MediaUploaderProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    const newFiles: FileWithPreview[] = selectedFiles.map(file => ({
      file,
      preview: file.type.startsWith("image/") 
        ? URL.createObjectURL(file) 
        : "",
      caption: ""
    }));

    setFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      // Revoke object URL to prevent memory leaks
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateCaption = (index: number, caption: string) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], caption };
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const totalFiles = files.length;
      let completed = 0;

      for (const fileData of files) {
        const { file, caption } = fileData;
        
        // Generate unique file path
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userId}/${campaignId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("campaign-media")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from("campaign_media")
          .insert({
            campaign_id: campaignId,
            user_id: userId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            media_type: file.type.startsWith("image/") ? "image" : "document",
            sort_order: completed,
            caption: caption || null
          });

        if (dbError) throw dbError;

        completed++;
        setUploadProgress((completed / totalFiles) * 100);
      }

      toast.success(`${totalFiles} arquivo(s) enviado(s) com sucesso!`);
      
      // Clean up previews
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      
      setFiles([]);
      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivos");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        className="p-6 border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Clique para selecionar arquivos</p>
            <p className="text-sm text-muted-foreground">
              ou arraste e solte aqui
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Imagens (JPG, PNG, GIF) ou documentos (PDF, DOC)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />
      </Card>

      {/* File Preview List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Arquivos selecionados ({files.length})</h4>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {files.map((fileData, index) => (
              <Card key={index} className="p-3">
                <div className="flex gap-3">
                  {/* Preview */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {fileData.preview ? (
                      <img 
                        src={fileData.preview} 
                        alt={fileData.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileUp className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileData.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Input
                      placeholder="Legenda (opcional)"
                      value={fileData.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      className="mt-2 h-8 text-xs"
                    />
                  </div>

                  {/* Remove */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Enviando... {Math.round(uploadProgress)}%
              </p>
            </div>
          )}

          {/* Upload Button */}
          <Button 
            onClick={handleUpload} 
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar {files.length} arquivo(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
