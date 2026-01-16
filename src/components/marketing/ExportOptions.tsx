import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Download, 
  FileImage, 
  FileText, 
  FileSpreadsheet, 
  Presentation,
  Loader2,
  ChevronDown
} from "lucide-react";
import { generatePDF, cleanupElement } from "@/lib/pdfGenerator";
import ExcelJS from "exceljs";

interface ExportOptionsProps {
  images: { url: string; caption?: string }[];
  fileName?: string;
  disabled?: boolean;
}

export const ExportOptions = ({ images, fileName = "carrossel", disabled = false }: ExportOptionsProps) => {
  const [exporting, setExporting] = useState<string | null>(null);

  const dataURLtoBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return response.blob();
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsJPG = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("jpg");

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // Create canvas to convert to JPG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();
        
        await new Promise<void>((resolve, reject) => {
          image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx?.drawImage(image, 0, 0);
            
            canvas.toBlob((blob) => {
              if (blob) {
                downloadFile(blob, `${fileName}-${i + 1}.jpg`);
              }
              resolve();
            }, 'image/jpeg', 0.9);
          };
          image.onerror = reject;
          image.src = img.url;
        });

        // Small delay between downloads
        if (i < images.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      toast.success(`${images.length} imagem(ns) exportada(s) como JPG!`);
    } catch (error) {
      console.error("Error exporting as JPG:", error);
      toast.error("Erro ao exportar como JPG");
    } finally {
      setExporting(null);
    }
  };

  const exportAsPNG = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("png");

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const blob = await dataURLtoBlob(img.url);
        downloadFile(blob, `${fileName}-${i + 1}.png`);

        // Small delay between downloads
        if (i < images.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      toast.success(`${images.length} imagem(ns) exportada(s) como PNG!`);
    } catch (error) {
      console.error("Error exporting as PNG:", error);
      toast.error("Erro ao exportar como PNG");
    } finally {
      setExporting(null);
    }
  };

  const exportAsPDF = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("pdf");

      // Create HTML content for PDF
      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.padding = '20px';
      container.style.fontFamily = 'Arial, sans-serif';

      // Title
      const title = document.createElement('h1');
      title.textContent = 'Carrossel de Campanha';
      title.style.textAlign = 'center';
      title.style.marginBottom = '30px';
      title.style.color = '#333';
      container.appendChild(title);

      // Images
      for (let i = 0; i < images.length; i++) {
        const slideContainer = document.createElement('div');
        slideContainer.style.marginBottom = '30px';
        slideContainer.style.pageBreakInside = 'avoid';

        const slideTitle = document.createElement('h3');
        slideTitle.textContent = `Slide ${i + 1}`;
        slideTitle.style.marginBottom = '10px';
        slideTitle.style.color = '#666';
        slideContainer.appendChild(slideTitle);

        const img = document.createElement('img');
        img.src = images[i].url;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        slideContainer.appendChild(img);

        if (images[i].caption) {
          const caption = document.createElement('p');
          caption.textContent = images[i].caption || '';
          caption.style.marginTop = '10px';
          caption.style.color = '#888';
          caption.style.fontStyle = 'italic';
          slideContainer.appendChild(caption);
        }

        container.appendChild(slideContainer);
      }

      // Generate PDF using secure jsPDF + html2canvas
      document.body.appendChild(container);
      
      try {
        await generatePDF(container, {
          filename: `${fileName}.pdf`,
          margin: 10,
          format: "a4",
          orientation: "portrait",
          scale: 2,
        });
        toast.success("PDF exportado com sucesso!");
      } finally {
        cleanupElement(container);
      }
    } catch (error) {
      console.error("Error exporting as PDF:", error);
      toast.error("Erro ao exportar como PDF");
    } finally {
      setExporting(null);
    }
  };

  const exportAsWord = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("word");

      // Create HTML content that Word can open
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; }
            .slide { margin-bottom: 30px; page-break-inside: avoid; }
            .slide h3 { color: #666; }
            .slide img { max-width: 100%; height: auto; border-radius: 8px; }
            .caption { color: #888; font-style: italic; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Carrossel de Campanha</h1>
      `;

      for (let i = 0; i < images.length; i++) {
        htmlContent += `
          <div class="slide">
            <h3>Slide ${i + 1}</h3>
            <img src="${images[i].url}" alt="Slide ${i + 1}">
            ${images[i].caption ? `<p class="caption">${images[i].caption}</p>` : ''}
          </div>
        `;
      }

      htmlContent += '</body></html>';

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      downloadFile(blob, `${fileName}.doc`);
      toast.success("Documento Word exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting as Word:", error);
      toast.error("Erro ao exportar como Word");
    } finally {
      setExporting(null);
    }
  };

  const exportAsExcel = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("excel");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Carrossel');

      // Headers
      worksheet.columns = [
        { header: 'Slide', key: 'slide', width: 10 },
        { header: 'Legenda', key: 'caption', width: 50 },
        { header: 'URL da Imagem', key: 'url', width: 80 }
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      for (let i = 0; i < images.length; i++) {
        worksheet.addRow({
          slide: i + 1,
          caption: images[i].caption || '',
          url: images[i].url.startsWith('data:') ? '[Imagem Base64]' : images[i].url
        });
      }

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadFile(blob, `${fileName}.xlsx`);
      toast.success("Planilha Excel exportada com sucesso!");
    } catch (error) {
      console.error("Error exporting as Excel:", error);
      toast.error("Erro ao exportar como Excel");
    } finally {
      setExporting(null);
    }
  };

  const exportAsPowerPoint = async () => {
    if (images.length === 0) {
      toast.error("Nenhuma imagem para exportar");
      return;
    }

    try {
      setExporting("pptx");

      // Create a simple HTML presentation that can be opened in PowerPoint
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            .slide { 
              width: 100%; 
              min-height: 100vh; 
              display: flex; 
              flex-direction: column; 
              justify-content: center; 
              align-items: center;
              page-break-after: always;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px;
              box-sizing: border-box;
            }
            .slide:last-child { page-break-after: avoid; }
            .slide img { 
              max-width: 80%; 
              max-height: 70vh; 
              border-radius: 12px; 
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .slide-number { 
              position: absolute; 
              top: 20px; 
              left: 20px; 
              color: white; 
              font-size: 24px; 
              font-weight: bold;
            }
            .caption { 
              color: white; 
              font-size: 24px; 
              margin-top: 20px; 
              text-align: center;
              max-width: 80%;
            }
          </style>
        </head>
        <body>
      `;

      for (let i = 0; i < images.length; i++) {
        htmlContent += `
          <div class="slide">
            <span class="slide-number">${i + 1}/${images.length}</span>
            <img src="${images[i].url}" alt="Slide ${i + 1}">
            ${images[i].caption ? `<p class="caption">${images[i].caption}</p>` : ''}
          </div>
        `;
      }

      htmlContent += '</body></html>';

      // PowerPoint can open HTML files
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-powerpoint' });
      downloadFile(blob, `${fileName}.ppt`);
      toast.success("Apresentação PowerPoint exportada com sucesso!");
    } catch (error) {
      console.error("Error exporting as PowerPoint:", error);
      toast.error("Erro ao exportar como PowerPoint");
    } finally {
      setExporting(null);
    }
  };

  const isExporting = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || images.length === 0 || isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Exportar
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Formatos de Imagem</DropdownMenuLabel>
        <DropdownMenuItem onClick={exportAsJPG} disabled={isExporting}>
          <FileImage className="h-4 w-4 mr-2 text-orange-500" />
          Exportar JPG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsPNG} disabled={isExporting}>
          <FileImage className="h-4 w-4 mr-2 text-blue-500" />
          Exportar PNG
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Documentos</DropdownMenuLabel>
        <DropdownMenuItem onClick={exportAsPDF} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsWord} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2 text-blue-600" />
          Exportar Word
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Planilhas & Apresentações</DropdownMenuLabel>
        <DropdownMenuItem onClick={exportAsExcel} disabled={isExporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsPowerPoint} disabled={isExporting}>
          <Presentation className="h-4 w-4 mr-2 text-orange-600" />
          Exportar PowerPoint
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
