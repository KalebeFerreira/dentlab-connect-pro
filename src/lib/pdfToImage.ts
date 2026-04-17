import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const DATA_URL_SEPARATOR = ",";

const dataUrlToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(DATA_URL_SEPARATOR)[1];

  if (!base64) {
    throw new Error("PDF inválido para leitura");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

export const isPdfFile = (fileType: string, dataUrl?: string) => {
  return fileType === "application/pdf" || dataUrl?.startsWith("data:application/pdf") === true;
};

export const renderPdfFirstPageToImage = async (
  pdfDataUrl: string,
  options?: {
    maxWidth?: number;
    quality?: number;
  }
) => {
  const pdfBytes = dataUrlToUint8Array(pdfDataUrl);
  const pdf = await getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(1);
  const firstViewport = page.getViewport({ scale: 1 });
  const targetWidth = options?.maxWidth ?? 1400;
  const scale = Math.min(targetWidth / firstViewport.width, 2);
  const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar o PDF para escaneamento");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;

  return canvas.toDataURL("image/jpeg", options?.quality ?? 0.92);
};
