export interface ParsedPdf {
  text: string;
  pages: number;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdf> {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const result = await pdfParse(buffer, { max: 0 });
  return {
    text: result.text ?? "",
    pages: result.numpages || 1,
  };
}
