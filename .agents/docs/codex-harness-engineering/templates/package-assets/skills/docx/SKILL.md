---
name: docx
description: Word 文档处理指南
---

# Word 文档处理指南

## 触发条件
创建/编辑 Word 文档、docx 文件生成、报告导出

## 推荐库
- **docx** (推荐): 纯 JS 实现，功能完整
- **officegen**: 支持多种 Office 格式
- **mammoth**: Word 转 HTML

## 基础用法 (docx 库)

```typescript
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from 'docx';
import * as fs from 'fs';

/**
 * 创建 Word 文档
 */
async function createDocument() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "标题",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "普通文本 ", bold: false }),
            new TextRun({ text: "加粗文本", bold: true }),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("output.docx", buffer);
}
```

## 常用功能

### 表格
```typescript
const table = new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("单元格1")] }),
        new TableCell({ children: [new Paragraph("单元格2")] }),
      ],
    }),
  ],
});
```

### 图片
```typescript
import { ImageRun } from 'docx';

new Paragraph({
  children: [
    new ImageRun({
      data: fs.readFileSync("image.png"),
      transformation: { width: 200, height: 150 },
    }),
  ],
});
```

### 页眉页脚
```typescript
import { Header, Footer } from 'docx';

const doc = new Document({
  sections: [{
    headers: {
      default: new Header({
        children: [new Paragraph("页眉内容")],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph("页脚内容")],
      }),
    },
    children: [],
  }],
});
```

## 最佳实践
- 复杂文档先定义样式模板
- 大文档使用流式写入
- 表格数据动态生成时注意空值处理
- 导出前验证文档结构完整性

