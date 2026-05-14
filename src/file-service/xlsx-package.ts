import JSZip from "jszip";

type FilePart = {
  partNo: number;
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

const zipGenerationOptions = {
  type: "nodebuffer" as const,
  compression: "DEFLATE" as const,
  compressionOptions: {
    level: 1
  }
};

export async function renderExportPackage(input: {
  packageFileName: string;
  parts: FilePart[];
}): Promise<Buffer> {
  if (input.parts.length === 1) {
    return renderWorkbookBuffer(input.parts[0]);
  }

  const archive = new JSZip();
  for (const part of input.parts) {
    archive.file(part.fileName, await renderWorkbookBuffer(part), {
      binary: true
    });
  }
  return archive.generateAsync(zipGenerationOptions);
}

async function renderWorkbookBuffer(part: FilePart): Promise<Buffer> {
  const workbook = new JSZip();
  workbook.file(
    "[Content_Types].xml",
    buildContentTypesXml()
  );
  workbook.file(
    "_rels/.rels",
    buildRootRelationshipsXml()
  );
  workbook.file(
    "xl/workbook.xml",
    buildWorkbookXml()
  );
  workbook.file(
    "xl/_rels/workbook.xml.rels",
    buildWorkbookRelationshipsXml()
  );
  workbook.file(
    "xl/worksheets/sheet1.xml",
    buildWorksheetXml(part)
  );
  return workbook.generateAsync(zipGenerationOptions);
}

function buildContentTypesXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    "</Types>"
  ].join("");
}

function buildRootRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>"
  ].join("");
}

function buildWorkbookXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<sheets>",
    '<sheet name="Export" sheetId="1" r:id="rId1"/>',
    "</sheets>",
    "</workbook>"
  ].join("");
}

function buildWorkbookRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    "</Relationships>"
  ].join("");
}

function buildWorksheetXml(part: FilePart): string {
  const rowValues = [part.headers, ...part.rows.map((row) => part.headers.map((header) => formatCellValue(row[header])))];
  const lastColumn = Math.max(part.headers.length, 1);
  const lastRow = Math.max(rowValues.length, 1);
  const dimension = `A1:${buildCellReference(lastColumn - 1, lastRow)}`;
  const rowsXml = rowValues
    .map((row, rowIndex) => buildWorksheetRowXml(row, rowIndex + 1))
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="${dimension}"/>`,
    "<sheetData>",
    rowsXml,
    "</sheetData>",
    "</worksheet>"
  ].join("");
}

function buildWorksheetRowXml(values: string[], rowNumber: number): string {
  const cellsXml = values
    .map((value, columnIndex) => {
      const cellReference = buildCellReference(columnIndex, rowNumber);
      return [
        `<c r="${cellReference}" t="inlineStr">`,
        "<is>",
        `<t xml:space="preserve">${escapeXml(value)}</t>`,
        "</is>",
        "</c>"
      ].join("");
    })
    .join("");
  return `<row r="${rowNumber}">${cellsXml}</row>`;
}

function buildCellReference(columnIndex: number, rowNumber: number): string {
  let current = columnIndex + 1;
  let letters = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }
  return `${letters}${rowNumber}`;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
