import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface PDFOptions {
  filename: string;
  margin?: number | [number, number, number, number];
  format?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  imageQuality?: number;
  scale?: number;
}

const defaultOptions: Required<PDFOptions> = {
  filename: "document.pdf",
  margin: 10,
  format: "a4",
  orientation: "portrait",
  imageQuality: 0.98,
  scale: 2,
};

/**
 * Generates a PDF from an HTML element using jsPDF and html2canvas
 * This is a secure replacement for the vulnerable html2pdf.js library
 */
export async function generatePDF(
  element: HTMLElement,
  options: PDFOptions
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  // Convert margin to array format if it's a number
  const margins = Array.isArray(opts.margin)
    ? opts.margin
    : [opts.margin, opts.margin, opts.margin, opts.margin];

  // Create canvas from HTML element
  const canvas = await html2canvas(element, {
    scale: opts.scale,
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: "#ffffff",
  });

  // Get canvas dimensions
  const imgData = canvas.toDataURL("image/jpeg", opts.imageQuality);
  
  // Create PDF with specified format and orientation
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: "mm",
    format: opts.format,
    compress: true,
  });

  // Get page dimensions
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Calculate available space after margins
  const availableWidth = pageWidth - margins[1] - margins[3];
  const availableHeight = pageHeight - margins[0] - margins[2];
  
  // Calculate image dimensions maintaining aspect ratio
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
  
  const scaledWidth = imgWidth * ratio;
  const scaledHeight = imgHeight * ratio;

  // Add image to PDF (handle multi-page if needed)
  const totalPages = Math.ceil(scaledHeight / availableHeight);
  
  if (totalPages === 1) {
    pdf.addImage(imgData, "JPEG", margins[3], margins[0], scaledWidth, scaledHeight);
  } else {
    // Multi-page handling
    // Multi-page handling
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      
      // Calculate portion of image to show on this page
      const sourceY = (i * availableHeight) / ratio;
      const sourceHeight = Math.min(availableHeight / ratio, imgHeight - sourceY);
      
      // Create a canvas for this page portion
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );
        
        const pageImgData = pageCanvas.toDataURL("image/jpeg", opts.imageQuality);
        const pageScaledHeight = sourceHeight * ratio;
        
        pdf.addImage(pageImgData, "JPEG", margins[3], margins[0], scaledWidth, pageScaledHeight);
      }
    }
  }

  // Save the PDF
  pdf.save(opts.filename);
}

/**
 * Generates a PDF blob from an HTML element for download or sharing
 * @param element - The HTML element to convert to PDF
 * @param options - PDF generation options (margin, format, orientation, scale)
 */
export async function generatePDFBlob(
  element: HTMLElement,
  options: Omit<PDFOptions, "filename">
): Promise<Blob> {
  const opts = { ...defaultOptions, ...options, filename: "temp.pdf" };
  
  const margins = Array.isArray(opts.margin)
    ? opts.margin
    : [opts.margin, opts.margin, opts.margin, opts.margin];

  const canvas = await html2canvas(element, {
    scale: opts.scale,
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/jpeg", opts.imageQuality);
  
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: "mm",
    format: opts.format,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const availableWidth = pageWidth - margins[1] - margins[3];
  const availableHeight = pageHeight - margins[0] - margins[2];
  
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
  
  const scaledWidth = imgWidth * ratio;
  const scaledHeight = imgHeight * ratio;

  const totalPages = Math.ceil(scaledHeight / availableHeight);
  
  if (totalPages === 1) {
    pdf.addImage(imgData, "JPEG", margins[3], margins[0], scaledWidth, scaledHeight);
  } else {
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      
      const sourceY = (i * availableHeight) / ratio;
      const sourceHeight = Math.min(availableHeight / ratio, imgHeight - sourceY);
      
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );
        
        const pageImgData = pageCanvas.toDataURL("image/jpeg", opts.imageQuality);
        const pageScaledHeight = sourceHeight * ratio;
        
        pdf.addImage(pageImgData, "JPEG", margins[3], margins[0], scaledWidth, pageScaledHeight);
      }
    }
  }

  return pdf.output("blob");
}

/**
 * Creates an element from HTML string for PDF generation
 */
export function createElementFromHTML(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  element.style.position = "absolute";
  element.style.left = "-9999px";
  element.style.top = "0";
  document.body.appendChild(element);
  return element;
}

/**
 * Cleanup helper for temporary elements
 */
export function cleanupElement(element: HTMLElement): void {
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}
