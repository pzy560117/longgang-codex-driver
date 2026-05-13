---
name: xlsx
description: Excel 表格处理指南
---

# Excel 表格处理指南

## 触发条件
Excel 读写、xlsx 文件、表格导出、数据报表

## 推荐库
- **exceljs** (推荐): 功能全面，支持样式和流式处理
- **xlsx/sheetjs**: 轻量级，读写速度快
- **xlsx-populate**: API 简洁

## 基础用法 (ExcelJS)

```typescript
import ExcelJS from 'exceljs';

/**
 * 创建 Excel 文件
 */
async function createExcel() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  // 设置列
  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: '名称', key: 'name', width: 20 },
    { header: '金额', key: 'amount', width: 15 },
  ];

  // 添加数据
  sheet.addRows([
    { id: 1, name: '产品A', amount: 100 },
    { id: 2, name: '产品B', amount: 200 },
  ]);

  await workbook.xlsx.writeFile('output.xlsx');
}
```

## 读取 Excel

```typescript
/**
 * 读取 Excel 文件
 */
async function readExcel(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sheet = workbook.getWorksheet(1);
  const data: any[] = [];
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // 跳过表头
      data.push({
        id: row.getCell(1).value,
        name: row.getCell(2).value,
        amount: row.getCell(3).value,
      });
    }
  });
  
  return data;
}
```

## 样式设置

```typescript
// 表头样式
sheet.getRow(1).eachCell(cell => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { horizontal: 'center' };
});

// 边框
cell.border = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

// 数字格式
cell.numFmt = '#,##0.00';
```

## 流式写入 (大数据量)

```typescript
/**
 * 流式写入，适合大数据量
 */
async function streamWrite(data: any[], outputPath: string) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outputPath,
  });
  
  const sheet = workbook.addWorksheet('Data');
  sheet.columns = [
    { header: 'ID', key: 'id' },
    { header: 'Value', key: 'value' },
  ];
  
  for (const item of data) {
    sheet.addRow(item).commit();
  }
  
  await workbook.commit();
}
```

## 公式和图表

```typescript
// 公式
sheet.getCell('D2').value = { formula: 'SUM(C2:C100)' };

// 数据验证（下拉列表）
sheet.getCell('B2').dataValidation = {
  type: 'list',
  allowBlank: true,
  formulae: ['"选项1,选项2,选项3"'],
};
```

## 最佳实践
- 大数据量使用流式 API
- 日期处理注意时区问题
- 合并单元格后注意样式应用
- 导出前验证数据类型一致性

