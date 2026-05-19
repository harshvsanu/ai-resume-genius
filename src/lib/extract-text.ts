// Client-side resume text extraction (PDF + DOCX)
import mammoth from "mammoth";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }
  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value.trim();
  }
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return await file.text();
  }
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT.");
}

async function extractPdfText(file: File): Promise<string> {
  // Dynamic import keeps pdfjs out of SSR
  const pdfjs = await import("pdfjs-dist");
  // Use a CDN worker matching the installed version
  // @ts-expect-error - GlobalWorkerOptions exists at runtime
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      // @ts-expect-error - 'str' exists on TextItem
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += text + "\n\n";
  }
  return fullText.trim();
}
