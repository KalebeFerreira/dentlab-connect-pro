import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eraser, Save } from "lucide-react";

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClear: () => void;
}

export const SignaturePad = ({ onSave, onClear }: SignaturePadProps) => {
  const sigPad = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigPad.current?.clear();
    onClear();
  };

  const handleSave = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      const signature = sigPad.current.toDataURL();
      onSave(signature);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura Digital</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-border rounded-lg overflow-hidden bg-background">
          <SignatureCanvas
            ref={sigPad}
            canvasProps={{
              className: "w-full h-48 cursor-crosshair",
            }}
            backgroundColor="white"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleClear} variant="outline" size="sm">
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleSave} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Salvar Assinatura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
