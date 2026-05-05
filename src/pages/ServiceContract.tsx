import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileSignature, Sparkles, Download, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { generatePDF } from "@/lib/pdfGenerator";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";
import ExcelJS from "exceljs";

const ServiceContract = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [contractText, setContractText] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [contractor, setContractor] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) generateContract();
  }, [id]);

  const generateContract = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("generate-service-contract", {
        body: { orderId: id, extraInstructions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setContractText(data.contract);
      setContractor(data.contractor);
      setOrder(data.order);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar contrato");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setGeneratingPdf(true);
      await generatePDF(printRef.current, {
        filename: `contrato-${order?.patient_name || "servico"}.pdf`,
        format: "a4",
        orientation: "portrait",
      });
      toast.success("PDF gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-2xl font-bold mt-4 mb-3 text-center">{line.replace("# ", "")}</h1>;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-semibold my-1">{line.replace(/\*\*/g, "")}</p>;
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} className="my-2 text-justify leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-14 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/orders/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Contrato de Prestação de Serviço
            </h1>
            <p className="text-xs text-muted-foreground">Gerado por IA com seus dados cadastrados</p>
          </div>
          <Button onClick={generateContract} disabled={loading} variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            {loading ? "Gerando..." : "Regerar"}
          </Button>
          <Button onClick={handleDownloadPdf} disabled={generatingPdf || !contractText} size="sm">
            {generatingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instruções extras (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="extra">Adicione cláusulas ou condições específicas</Label>
            <Textarea
              id="extra"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="Ex: incluir cláusula de garantia de 90 dias, pagamento em 2x..."
              rows={3}
            />
            <Button onClick={generateContract} disabled={loading} size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Aplicar e regerar com IA
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Gerando contrato com IA...</span>
              </div>
            ) : (
              <div ref={printRef} className="bg-white text-black p-8 rounded-md">
                <div className="prose max-w-none">
                  {renderMarkdown(contractText)}
                </div>
                {signature && (
                  <div className="mt-8 pt-6 border-t">
                    <p className="text-sm text-gray-600 mb-2">Assinatura do CONTRATADO:</p>
                    <img src={signature} alt="Assinatura" className="max-h-32 border rounded p-2" />
                    <p className="text-sm mt-2 font-semibold">{contractor?.nome}</p>
                    <p className="text-xs text-gray-600">{contractor?.cpf_cnpj}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <SignaturePad value={signature} onSignatureChange={setSignature} />
      </main>
    </div>
  );
};

export default ServiceContract;
