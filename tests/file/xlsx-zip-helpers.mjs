import assert from "node:assert/strict";
import JSZip from "jszip";

const requiredWorkbookEntries = [
  "[Content_Types].xml",
  "_rels/.rels",
  "xl/workbook.xml",
  "xl/worksheets/sheet1.xml"
];

export async function inspectXlsxBuffer(buffer, options = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const entryNames = listEntryNames(zip);
  for (const entryName of requiredWorkbookEntries) {
    assert.ok(entryNames.includes(entryName), `expected XLSX entry ${entryName}`);
  }

  const sharedStringsXml = await readOptionalEntry(zip, "xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const sheetXml = await readEntry(zip, "xl/worksheets/sheet1.xml");
  const worksheet = parseWorksheetRows(sheetXml, sharedStrings, options.mode ?? "all");

  return {
    entryNames,
    sheetXml,
    sharedStringsXml,
    header: worksheet.header,
    rowCount: worksheet.rowCount,
    rows: worksheet.rows,
    firstDataRow: worksheet.firstDataRow,
    lastDataRow: worksheet.lastDataRow
  };
}

export async function inspectZipOfXlsxBuffer(buffer, options = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const entryNames = listEntryNames(zip);
  const partNames = entryNames.filter((entryName) => entryName.endsWith(".xlsx")).sort();
  const parts = [];

  for (const partName of partNames) {
    const file = zip.file(partName);
    assert.ok(file, `expected ZIP entry ${partName}`);
    const workbookBuffer = await file.async("nodebuffer");
    parts.push({
      name: partName,
      workbook: await inspectXlsxBuffer(workbookBuffer, options)
    });
  }

  return {
    entryNames,
    parts,
    totalRowCount: parts.reduce((sum, part) => sum + part.workbook.rowCount, 0)
  };
}

export async function xlsxContainsText(buffer, needle) {
  const zip = await JSZip.loadAsync(buffer);
  for (const file of Object.values(zip.files)) {
    if (file.dir || !file.name.endsWith(".xml")) {
      continue;
    }
    const xml = await file.async("string");
    if (xml.includes(needle)) {
      return true;
    }
  }
  return false;
}

export async function zipOfXlsxContainsText(buffer, needle) {
  const zip = await JSZip.loadAsync(buffer);
  for (const entryName of listEntryNames(zip)) {
    if (!entryName.endsWith(".xlsx")) {
      continue;
    }
    const workbookBuffer = await zip.file(entryName).async("nodebuffer");
    if (await xlsxContainsText(workbookBuffer, needle)) {
      return true;
    }
  }
  return false;
}

function listEntryNames(zip) {
  return Object.values(zip.files)
    .filter((file) => !file.dir)
    .map((file) => file.name)
    .sort();
}

async function readEntry(zip, entryName) {
  const file = zip.file(entryName);
  assert.ok(file, `expected ZIP entry ${entryName}`);
  return file.async("string");
}

async function readOptionalEntry(zip, entryName) {
  const file = zip.file(entryName);
  if (!file) {
    return null;
  }
  return file.async("string");
}

function parseSharedStrings(xml) {
  return Array.from(xml.matchAll(/<si>\s*<t(?: xml:space="preserve")?>([\s\S]*?)<\/t>\s*<\/si>/g)).map(
    (match) => decodeXml(match[1] ?? "")
  );
}

function parseWorksheetRows(sheetXml, sharedStrings, mode) {
  const rowMatches = Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g));
  let header = [];
  const rows = mode === "all" ? [] : undefined;
  let firstDataRow = null;
  let lastDataRow = null;

  for (const [rowIndex, rowMatch] of rowMatches.entries()) {
    const row = parseRowCells(rowMatch[1] ?? "", sharedStrings);
    if (rowIndex === 0) {
      header = row;
      continue;
    }

    if (rows) {
      rows.push(row);
    }
    if (!firstDataRow) {
      firstDataRow = row;
    }
    lastDataRow = row;
  }

  return {
    header,
    rowCount: Math.max(rowMatches.length - 1, 0),
    rows,
    firstDataRow,
    lastDataRow
  };
}

function parseRowCells(rowXml, sharedStrings) {
  const cells = [];
  for (const match of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const cellAttributes = match[1] ?? "";
    const cellBody = match[2] ?? "";
    const referenceMatch = /r="([A-Z]+)\d+"/.exec(cellAttributes);
    const columnIndex = referenceMatch ? columnLettersToIndex(referenceMatch[1]) : cells.length;
    cells[columnIndex] = readCellValue(cellAttributes, cellBody, sharedStrings);
  }
  return cells.map((value) => value ?? "");
}

function readCellValue(attributes, body, sharedStrings) {
  const typeMatch = /t="([^"]+)"/.exec(attributes);
  const cellType = typeMatch?.[1] ?? "";
  if (cellType === "inlineStr") {
    const textMatch = /<t(?: xml:space="preserve")?>([\s\S]*?)<\/t>/.exec(body);
    return decodeXml(textMatch?.[1] ?? "");
  }
  if (cellType === "s") {
    const valueMatch = /<v>(\d+)<\/v>/.exec(body);
    const index = Number(valueMatch?.[1] ?? -1);
    return sharedStrings[index] ?? "";
  }
  const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
  return decodeXml(valueMatch?.[1] ?? "");
}

function columnLettersToIndex(letters) {
  let index = 0;
  for (const character of letters) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index - 1;
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
