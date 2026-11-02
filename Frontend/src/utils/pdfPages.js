// Shared PDF.js rasterization, extracted from TextbookEditor.importFile.
export async function openPdf(data) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data }).promise;
}
export async function renderPdfPage(doc, number, scale = 1.3) {
  const page = await doc.getPage(number), viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  try {
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return { src: canvas.toDataURL('image/jpeg', .86), width: viewport.width, height: viewport.height };
  } finally { page.cleanup(); canvas.width = canvas.height = 0; }
}
