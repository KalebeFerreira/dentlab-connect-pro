import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileDown, Image as ImageIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import html2pdf from "html2pdf.js";

interface PriceItem {
  id: string;
  workType: string;
  description: string;
  price: string;
  imageUrl: string | null;
  generating: boolean;
}

export const PriceTableGenerator = () => {
  const [items, setItems] = useState<PriceItem[]>([
    { id: "1", workType: "", description: "", price: "", imageUrl: null, generating: false },
  ]);
  const [tableName, setTableName] = useState("Tabela de Preços - Laboratório");
  const [exporting, setExporting] = useState(false);

  const addItem = () => {
    const newItem: PriceItem = {
      id: Date.now().toString(),
      workType: "",
      description: "",
      price: "",
      imageUrl: null,
      generating: false,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof PriceItem, value: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const generateImage = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || !item.workType) {
      toast.error("Preencha o tipo de trabalho primeiro");
      return;
    }

    setItems(items.map((i) => (i.id === id ? { ...i, generating: true } : i)));

    try {
      const prompt = `Trabalho odontológico profissional: ${item.workType}. ${item.description}. Imagem técnica de alta qualidade, iluminação de laboratório, fundo branco neutro, foco nítido, estilo fotografia odontológica profissional.`;

      const { data, error } = await supabase.functions.invoke("generate-dental-image", {
        body: {
          prompt,
          workType: item.workType,
          teethNumbers: "N/A",
          color: "natural",
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setItems(
          items.map((i) =>
            i.id === id ? { ...i, imageUrl: data.imageUrl, generating: false } : i
          )
        );
        toast.success("Imagem gerada com sucesso!");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error("Erro ao gerar imagem", {
        description: error.message,
      });
      setItems(items.map((i) => (i.id === id ? { ...i, generating: false } : i)));
    }
  };

  const exportToPDF = async () => {
    // Validate items
    const validItems = items.filter(
      (item) => item.workType && item.price
    );

    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item válido para exportar");
      return;
    }

    setExporting(true);

    try {
      // Call edge function to get formatted HTML
      const { data, error } = await supabase.functions.invoke("generate-price-table-pdf", {
        body: {
          tableName,
          items: validItems,
        },
      });

      if (error) throw error;

      if (!data?.html) {
        throw new Error("Erro ao gerar HTML do PDF");
      }

      // Create temporary container
      const container = document.createElement("div");
      container.innerHTML = data.html;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      // Configure pdf options
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${tableName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      };

      // Generate PDF
      await html2pdf().set(opt).from(container).save();

      // Clean up
      document.body.removeChild(container);

      toast.success("PDF gerado com sucesso!");
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF", {
        description: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Gerador de Tabela de Preços</CardTitle>
        <CardDescription>
          Crie tabelas de preços profissionais com imagens geradas por IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="tableName">Nome da Tabela</Label>
          <Input
            id="tableName"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Ex: Tabela de Preços - Laboratório DentTech"
          />
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Tipo de Trabalho</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">Preço (R$)</TableHead>
                <TableHead className="w-[150px]">Imagem</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Input
                      value={item.workType}
                      onChange={(e) => updateItem(item.id, "workType", e.target.value)}
                      placeholder="Ex: Coroa"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Ex: Porcelana pura"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", e.target.value)}
                      placeholder="0,00"
                      type="number"
                      step="0.01"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.workType}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateImage(item.id)}
                        disabled={item.generating || !item.workType}
                      >
                        {item.generating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-3">
          <Button onClick={addItem} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
          <Button onClick={exportToPDF} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Exportar PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
