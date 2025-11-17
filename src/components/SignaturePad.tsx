import { useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  value?: string | null;
}

export const SignaturePad = ({ onSignatureChange, value }: SignaturePadProps) => {
  const sigPadRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (value && sigPadRef.current) {
      sigPadRef.current.fromDataURL(value);
    }
  }, [value]);

  const handleClear = () => {
    sigPadRef.current?.clear();
    onSignatureChange(null);
  };

  const handleEnd = () => {
    if (sigPadRef.current) {
      const signature = sigPadRef.current.toDataURL();
      onSignatureChange(signature);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Assinatura Digital
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-white">
          <SignatureCanvas
            ref={sigPadRef}
            canvasProps={{
              className: "w-full h-40 cursor-crosshair",
            }}
            onEnd={handleEnd}
            penColor="black"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Desenhe sua assinatura acima
        </p>
      </CardContent>
    </Card>
  );
};
