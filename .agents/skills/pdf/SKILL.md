---
name: pdf
description: PDF 文件处理指南
---

# PDF 文件处理指南

## 触发条件
生成 PDF、PDF 解析、PDF 合并、报表导出

## 推荐库

### 生成 PDF
- **pdf-lib** (推荐): 纯 JS，支持创建和修改
- **pdfkit**: Node.js 原生，功能强大
- **puppeteer**: HTML 转 PDF，适合复杂排版

### 解析 PDF
- **pdf-parse**: 提取文本内容
- **pdfjs-dist**: Mozilla 官方库

## 生成 PDF (pdf-lib)

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';

/**
 * 创建简单 PDF
 */
async function createPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 尺寸
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('Hello World', {
    x: 50,
    y: 750,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('output.pdf', pdfBytes);
}
```

## HTML 转 PDF (Puppeteer)

```typescript
import puppeteer from 'puppeteer';

/**
 * HTML 转 PDF，适合复杂排版
 */
async function htmlToPDF(html: string, outputPath: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
  });
  
  await browser.close();
}
```

## 解析 PDF

```typescript
import pdf from 'pdf-parse';
import * as fs from 'fs';

/**
 * 提取 PDF 文本
 */
async function extractText(pdfPath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  return data.text;
}
```

## 合并 PDF

```typescript
import { PDFDocument } from 'pdf-lib';

/**
 * 合并多个 PDF 文件
 */
async function mergePDFs(pdfPaths: string[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdfPath of pdfPaths) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }
  
  return mergedPdf.save();
}
```

## 最佳实践
- 中文支持需嵌入字体文件
- 复杂排版优先用 HTML + Puppeteer
- 大文件处理注意内存占用
- 敏感文档考虑加密和权限设置

