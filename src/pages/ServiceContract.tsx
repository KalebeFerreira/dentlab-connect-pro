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

  const handleDownloadWord = async () => {
    try {
      const lines = contractText.split("\n");
      const children: Paragraph[] = [];
      lines.forEach((line) => {
        if (line.startsWith("# ")) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: line.replace("# ", ""), bold: true, size: 32 })] }));
        } else if (line.startsWith("## ")) {
          children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: line.replace("## ", ""), bold: true, size: 28 })] }));
        } else if (line.startsWith("**") && line.endsWith("**")) {
          children.push(new Paragraph({ children: [new TextRun({ text: line.replace(/\*\*/g, ""), bold: true, size: 24 })] }));
        } else if (!line.trim()) {
          children.push(new Paragraph({ children: [new TextRun("")] }));
        } else {
          children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: line, size: 24 })] }));
        }
      });

      if (signature) {
        children.push(new Paragraph({ children: [new TextRun("")] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Assinatura do CONTRATADO:", size: 22 })] }));
        try {
          const base64 = signature.split(",")[1];
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: bytes, transformation: { width: 200, height: 100 } } as any)] }));
        } catch {}
        children.push(new Paragraph({ children: [new TextRun({ text: contractor?.nome || "", bold: true, size: 22 })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: contractor?.cpf_cnpj || "", size: 20 })] }));
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-${order?.patient_name || "servico"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar Word");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Contrato");
      ws.columns = [{ width: 110 }];
      contractText.split("\n").forEach((line) => {
        const row = ws.addRow([line.replace(/^#+\s*/, "").replace(/\*\*/g, "")]);
        const cell = row.getCell(1);
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.font = { size: 12, bold: line.startsWith("#") || (line.startsWith("**") && line.endsWith("**")) };
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-${order?.patient_name || "servico"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar Excel");
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-2xl font-bold mt-6 mb-3">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-3xl font-bold mt-6 mb-4 text-center">{line.replace("# ", "")}</h1>;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-semibold my-2 text-base">{line.replace(/\*\*/g, "")}</p>;
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} className="my-3 text-justify leading-7 text-base">{line}</p>;
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
          <Button onClick={handleDownloadWord} disabled={!contractText} size="sm" variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Word
          </Button>
          <Button onClick={handleDownloadExcel} disabled={!contractText} size="sm" variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
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
              <div ref={printRef} className="bg-white text-black p-12 rounded-md mx-auto" style={{ width: "794px", fontSize: "16px", lineHeight: "1.7", fontFamily: "Georgia, serif" }}>
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
