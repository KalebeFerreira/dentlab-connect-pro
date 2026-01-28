import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileDown, Image as ImageIcon, Sparkles, Wand2, Share2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { generatePDFBlob as createPDFBlob } from "@/lib/pdfGenerator";
import { PriceTableShareDialog } from "./PriceTableShareDialog";
import { PriceTableScanner } from "./price-table/PriceTableScanner";
import { SavedPriceTables } from "./price-table/SavedPriceTables";

export interface PriceItem {
  id: string;
  workType: string;
  description: string;
  price: string;
  imageUrl: string | null;
  generating: boolean;
}

const DEFAULT_DENTAL_WORKS = [
  { workType: "Coroa de Porcelana", description: "Cerâmica pura, alta estética", price: "" },
  { workType: "Implante Dentário", description: "Titânio com componente protético", price: "" },
  { workType: "Protocolo Superior", description: "Prótese fixa sobre implantes", price: "" },
  { workType: "Ponte Fixa 3 Elementos", description: "Metal-cerâmica", price: "" },
  { workType: "Faceta de Porcelana", description: "Laminado ultra fino", price: "" },
  { workType: "Prótese Total", description: "Resina acrílica completa", price: "" },
];

export const PriceTableGenerator = () => {
  const [items, setItems] = useState<PriceItem[]>([
    { id: "1", workType: "", description: "", price: "", imageUrl: null, generating: false },
  ]);
  const [tableName, setTableName] = useState("Tabela de Preços - Laboratório");
  const [laboratoryName, setLaboratoryName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingTable, setGeneratingTable] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showPrices, setShowPrices] = useState(true);

  useEffect(() => {
    const fetchLaboratoryInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("laboratory_info")
          .select("lab_name")
          .eq("user_id", user.id)
          .single();

        if (!error && data) {
          setLaboratoryName(data.lab_name);
        }
      } catch (error) {
        console.error("Error fetching laboratory info:", error);
      }
    };

    fetchLaboratoryInfo();
  }, []);

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

  const generateAllImages = async () => {
    // Find items that need images (have workType but no imageUrl)
    const itemsNeedingImages = items.filter(
      (item) => item.workType && !item.imageUrl && !item.generating
    );

    if (itemsNeedingImages.length === 0) {
      toast.error("Nenhum item precisa de imagem", {
        description: "Todos os itens já possuem imagem ou não têm tipo de trabalho definido",
      });
      return;
    }

    setGeneratingAll(true);
    toast.info(`Gerando ${itemsNeedingImages.length} imagens...`, {
      description: "Aguarde enquanto as imagens são geradas",
    });

    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsNeedingImages) {
      setItems((currentItems) =>
        currentItems.map((i) => (i.id === item.id ? { ...i, generating: true } : i))
      );

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

        if (error) {
          console.error("Error from function:", error);
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.imageUrl) {
          setItems((currentItems) =>
            currentItems.map((i) =>
              i.id === item.id ? { ...i, imageUrl: data.imageUrl, generating: false } : i
            )
          );
          successCount++;
        }
      } catch (error: any) {
        console.error("Error generating image:", error);
        setItems((currentItems) =>
          currentItems.map((i) => (i.id === item.id ? { ...i, generating: false } : i))
        );
        errorCount++;
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setGeneratingAll(false);

    if (successCount > 0) {
      toast.success(`${successCount} imagem(ns) gerada(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} imagem(ns) falharam`, {
        description: "Você pode tentar gerar novamente",
      });
    }
  };

  const generateCompleteTable = async () => {
    if (items.length === 1 && !items[0].workType) {
      // If there's only the default empty item, populate with defaults
      setGeneratingTable(true);
      
      const newItems: PriceItem[] = DEFAULT_DENTAL_WORKS.map((work, index) => ({
        id: `generated_${Date.now()}_${index}`,
        workType: work.workType,
        description: work.description,
        price: work.price,
        imageUrl: null,
        generating: false,
      }));

      setItems(newItems);
      
      toast.info("Tabela gerada! Gerando imagens...", {
        description: `${newItems.length} trabalhos adicionados`,
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate images for the new items
      await generateImagesForItems(newItems);
      setGeneratingTable(false);
    } else {
      // Generate images only for items that have workType but no image
      toast.info("Gerando imagens para os trabalhos existentes...");
      await generateAllImages();
    }
  };

  const generateImagesForItems = async (itemsToGenerate: PriceItem[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsToGenerate) {
      setItems((currentItems) =>
        currentItems.map((i) => (i.id === item.id ? { ...i, generating: true } : i))
      );

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

        if (error) {
          console.error("Error from function:", error);
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.imageUrl) {
          setItems((currentItems) =>
            currentItems.map((i) =>
              i.id === item.id ? { ...i, imageUrl: data.imageUrl, generating: false } : i
            )
          );
          successCount++;
        }
      } catch (error: any) {
        console.error("Error generating image for item:", item.workType, error);
        setItems((currentItems) =>
          currentItems.map((i) => (i.id === item.id ? { ...i, generating: false } : i))
        );
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (successCount > 0) {
      toast.success("Imagens geradas!", {
        description: `${successCount} imagens criadas com sucesso`,
      });
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} imagens falharam`, {
        description: "Você pode tentar gerar novamente",
      });
    }
  };

  const generatePDFBlob = async () => {
    // Validate items - allow items without price if showPrices is false
    const validItems = items.filter(
      (item) => item.workType && (showPrices ? item.price : true)
    );

    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item com tipo de trabalho");
      return null;
    }

    try {
      console.log("Generating PDF with items:", validItems.length);
      
      // Call edge function to get formatted HTML
      const { data, error } = await supabase.functions.invoke("generate-price-table-pdf", {
        body: {
          tableName,
          items: validItems.map(item => ({
            workType: item.workType,
            description: item.description || "",
            price: item.price || "0",
            imageUrl: item.imageUrl,
          })),
          laboratoryName,
          showPrices,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao chamar o servidor");
      }

      if (data?.error) {
        console.error("Edge function returned error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.html) {
        throw new Error("Erro ao gerar HTML do PDF - resposta vazia");
      }

      console.log("HTML received from edge function, length:", data.html.length);

      // Create a temporary div to render the HTML (more reliable than iframe)
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = "210mm";
      container.style.background = "white";
      container.innerHTML = data.html;
      document.body.appendChild(container);

      // Wait for images to load
      const images = container.querySelectorAll("img");
      if (images.length > 0) {
        console.log("Waiting for", images.length, "images to load");
        await Promise.all(
          Array.from(images).map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                  resolve();
                } else {
                  img.onload = () => resolve();
                  img.onerror = () => {
                    console.warn("Image failed to load:", img.src?.substring(0, 100));
                    // Hide broken images
                    img.style.display = "none";
                    resolve();
                  };
                  // Timeout for each image
                  setTimeout(() => resolve(), 3000);
                }
              })
          )
        );
      }

      // Give a moment for any final rendering
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log("Generating PDF from container");

      // Generate PDF as blob using secure jsPDF + html2canvas
      const pdfBlob = await createPDFBlob(container, {
        margin: [10, 10, 10, 10],
        format: "a4",
        orientation: "portrait",
        scale: 2,
      });

      console.log("PDF generated, blob size:", pdfBlob.size);

      // Clean up
      document.body.removeChild(container);

      if (pdfBlob.size < 500) {
        throw new Error("PDF gerado está muito pequeno, pode estar vazio");
      }

      return pdfBlob;
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF", {
        description: error.message || "Erro desconhecido",
      });
      return null;
    }
  };

  const downloadPDF = async () => {
    // Validate items - allow items without price if showPrices is false
    const validItems = items.filter(item => item.workType && (showPrices ? item.price : true));
    
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item com tipo de trabalho");
      return;
    }

    if (!tableName.trim()) {
      toast.error("Digite um nome para a tabela");
      return;
    }

    setExporting(true);

    try {
      const blob = await generatePDFBlob();
      
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${tableName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("PDF baixado com sucesso!");
      }
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Erro ao baixar PDF");
    } finally {
      setExporting(false);
    }
  };

  const saveTable = async () => {
    // Validate items - allow items without price if showPrices is false
    const validItems = items.filter(item => item.workType && (showPrices ? item.price : true));
    
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item com tipo de trabalho");
      return;
    }

    if (!tableName.trim()) {
      toast.error("Digite um nome para a tabela");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Convert items to plain JSON format (remove id and generating fields)
      const itemsToSave = validItems.map(({ id, generating, ...item }) => item);

      const { error } = await supabase.from("price_tables").insert([{
        user_id: user.id,
        table_name: tableName,
        notes: laboratoryName || null,
        items: itemsToSave as any,
      }]);

      if (error) throw error;
      toast.success("Tabela salva no banco de dados com sucesso!");
    } catch (error: any) {
      console.error("Error saving table:", error);
      toast.error("Erro ao salvar tabela", { description: error.message });
    }
  };

  const handleScannedItems = (scannedItems: { workType: string; description: string; price: string }[]) => {
    const newItems: PriceItem[] = scannedItems.map((item, index) => ({
      id: `scanned_${Date.now()}_${index}`,
      workType: item.workType,
      description: item.description,
      price: item.price,
      imageUrl: null,
      generating: false,
    }));

    // Replace empty items or add to existing
    if (items.length === 1 && !items[0].workType) {
      setItems(newItems);
    } else {
      setItems([...items, ...newItems]);
    }
  };

  const handleLoadSavedTable = (
    loadedTableName: string, 
    loadedItems: { workType: string; description: string; price: string; imageUrl: string | null }[]
  ) => {
    setTableName(loadedTableName);
    setItems(loadedItems.map((item, index) => ({
      id: `loaded_${Date.now()}_${index}`,
      workType: item.workType,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      generating: false,
    })));
  };

  return (
    <div className="space-y-6">
      {/* Scanner and Saved Tables Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <PriceTableScanner onItemsScanned={handleScannedItems} />
        <SavedPriceTables onLoadTable={handleLoadSavedTable} />
      </div>

      {/* Main Generator Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Gerador de Tabela de Preços</CardTitle>
          <CardDescription>
            Crie tabelas de preços profissionais com imagens geradas por IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">Nome da Tabela</Label>
              <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Ex: Tabela de Preços - Laboratório DentTech"
            />
          </div>
          <div className="flex items-center space-x-3">
            <Switch
              id="showPrices"
              checked={showPrices}
              onCheckedChange={setShowPrices}
            />
            <Label htmlFor="showPrices" className="cursor-pointer">
              Exibir valores no PDF
            </Label>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Tipo de Trabalho</TableHead>
                <TableHead className="min-w-[180px]">Descrição</TableHead>
                <TableHead className="min-w-[120px]">Preço (R$)</TableHead>
                <TableHead className="min-w-[140px]">Imagem</TableHead>
                <TableHead className="min-w-[80px]">Ações</TableHead>
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
                      className="w-full min-w-[160px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Ex: Porcelana pura"
                      className="w-full min-w-[160px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", e.target.value)}
                      placeholder="0,00"
                      type="number"
                      step="0.01"
                      className="w-full min-w-[100px]"
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

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={generateCompleteTable}
            disabled={generatingTable}
            variant="default"
            className="gap-2"
          >
            {generatingTable ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Gerar Tabela Completa
          </Button>
          <Button onClick={addItem} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
          <Button
            onClick={generateAllImages}
            disabled={generatingAll || generatingTable || items.every((i) => !i.workType || i.imageUrl)}
            variant="secondary"
            className="gap-2"
          >
            {generatingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar Todas Imagens
          </Button>
          <Button 
            onClick={() => setShareDialogOpen(true)} 
            disabled={!items.some(i => i.workType && i.price)}
            variant="outline"
            className="gap-2"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          <Button
            onClick={saveTable} 
            disabled={!items.some(i => i.workType && i.price)}
            variant="secondary"
            className="gap-2"
          >
            Salvar Tabela
          </Button>
          <Button onClick={downloadPDF} disabled={exporting || generatingTable} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
        </div>
      </CardContent>

        <PriceTableShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          tableName={tableName}
          items={items}
          laboratoryName={laboratoryName}
        />
      </Card>
    </div>
  );
};
