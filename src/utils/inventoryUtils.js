import * as XLSX from 'xlsx';

// 輸出的庫別欄（順序即輸出順序）。未來要加庫別在這裡擴充即可，
// 下拉選單、byCategory 分桶、輸出欄位都由這份常數推導。
export const CATEGORIES = ['總倉', '官網', '平台', '展威', 'ELLE', '誠品'];

// 貨號：商品代號有兩個 - 才取，SG 開頭取前 12 字，其餘取前 13 字
export const getItemNumber = (productCode) => {
  const code = productCode?.toString() ?? '';
  if (code.split('-').length - 1 !== 2) return '';
  return code.slice(0, code.startsWith('SG') ? 12 : 13);
};

// 倉庫名稱 → 預設庫別。先命中先算，順序不可調換：
// 「展威麗嬰房(平台總倉)」同時含「平台」「總倉」，不先攔會被判成平台。
export const resolveSourceType = (warehouseName) => {
  const name = warehouseName?.toString() ?? '';
  if (name.includes('展威麗嬰房(平台總倉)')) return '展威';
  if (name.includes('平台') || name.includes('平臺')) return '平台';
  if (name.includes('電商') || name.includes('官網')) return '官網';
  return '總倉';  //1140922 未知一律丟總倉
};

// 從已命中的規則中挑最長前綴；同長時因 sort 穩定會保留原列序（列序在前者勝）
const longestPrefixMatch = (code, rules) =>
  rules
    .filter(r => r.prefix && code.startsWith(r.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];

// 決定單列可售量該落在哪個庫別。
// 優先序：有勾「凌駕」且貨號開頭命中的規則 > 倉庫對應；未勾凌駕的規則不生效。
export const resolveCategory = (productCode, warehouseName, warehouseMapping = {}, categoryRules = []) => {
  const code = productCode?.toString() ?? '';
  const override = longestPrefixMatch(code, categoryRules.filter(r => r.override));
  if (override) return override.category;
  return warehouseMapping[warehouseName] || resolveSourceType(warehouseName);
};

// 貨號開頭 → 品牌名，最長命中前綴優先，無命中留白
export const resolveBrand = (productCode, brandRules = []) => {
  const code = productCode?.toString() ?? '';
  const match = longestPrefixMatch(code, brandRules);
  return match ? match.brand : '';
};

// 列出本次檔案所有貨號的開頭字元，提示使用者可設定哪些前綴
export const detectCodePrefixes = (extractedTables) => {
  const set = new Set();
  extractedTables.forEach(table =>
    table.dataRows.forEach(({ data }) => {
      const code = (data[0] ?? '').toString().trim();
      if (code) set.add(code[0]);
    })
  );
  return [...set].sort();
};

// 解析單一檔案的表格區塊
export const parseTableBlocks = (jsonData, fileName) => {
  const tables = [];
  let currentTable = null;

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const rowText = row.join('').toLowerCase();
    const firstCell = (row[0] ?? '').toString().trim();
    // 來源檔的區塊標題長這樣：「倉庫 :展威麗嬰房(平台總倉)」
    const isWarehouseRow = firstCell.startsWith('倉庫');

    // 檢查是否為表格名稱行
    if (isWarehouseRow ||
        rowText.includes('展') || rowText.includes('總倉') || rowText.includes('電商') || rowText.includes('平台') ||
        rowText.includes('官網') || rowText.includes('倉庫')) {
      // 保存前一個表格
      if (currentTable && currentTable.dataRows.length > 0) {
        tables.push(currentTable);
      }

      // 開始新表格。倉庫列取「倉庫 :」後面的實際倉庫名稱，其餘沿用整格文字
      const tableName = isWarehouseRow
        ? firstCell.replace(/^倉庫\s*[:：]?\s*/, '')
        : firstCell;

      currentTable = {
        name: tableName,
        sourceType: resolveSourceType(tableName),
        fileName,
        nameRow: i,
        headerRow: -1,
        dataRows: [],
        summaryRow: -1
      };
    }
    // 檢查是否為標題行
    else if (currentTable && rowText.includes('商品代號') && rowText.includes('商品名稱')) {
      currentTable.headerRow = i;
      currentTable.headers = row;
    }
    // 檢查是否為統計行
    else if (currentTable && (rowText.includes('小計') || rowText.includes('合計') || rowText.includes('數量'))) {
      currentTable.summaryRow = i;
    }
    // 檢查是否為資料行
    else if (currentTable && currentTable.headerRow !== -1 && row[0] &&
             !rowText.includes('小計') && !rowText.includes('合計') && !rowText.includes('數量')) {
      if (row[0].toString().trim() !== '' && row.length > 5) {
        currentTable.dataRows.push({
          rowIndex: i,
          data: row
        });
      }
    }
  }

  // 保存最後一個表格
  if (currentTable && currentTable.dataRows.length > 0) {
    tables.push(currentTable);
  }

  return tables;
};

// 讀取單一 Excel 檔並解析出區塊（只讀第一個工作表）
export const readSourceFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        resolve({ name: file.name, tables: parseTableBlocks(jsonData, file.name) });
      } catch (error) {
        reject(new Error(`讀取檔案 ${file.name} 時發生錯誤: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error(`讀取檔案 ${file.name} 失敗`));
    reader.readAsBinaryString(file);
  });

// 來源欄位索引（來源檔的欄位順序固定）
const COL = { code: 0, name: 1, inventory: 11, price: 12, year: 13, size: 15 };

// 把所有區塊合併成庫存匯總。
// config：warehouseMapping（倉庫→庫別）、categoryRules（貨號→庫別 覆蓋）、brandRules（貨號→品牌）。
// 庫存分桶原則：同一庫別下再依「原始倉庫名稱」記錄——同倉庫重複出現（分頁）覆蓋不累加，
// 不同倉庫落在同一庫別則相加。
export const buildSummary = (extractedTables, config = {}) => {
  const { warehouseMapping = {}, categoryRules = [], brandRules = [] } = config;
  const inventoryMap = {};

  extractedTables.forEach(table => {
    table.dataRows.forEach(({ data: row }) => {
      const productCode = row[COL.code];
      if (!productCode) return;

      const key = `${productCode}`;
      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          productCode,
          productName: row[COL.name],
          sizeName: row[COL.size],
          year: row[COL.year],
          price: row[COL.price],
          brand: resolveBrand(productCode, brandRules),
          byCategory: Object.fromEntries(CATEGORIES.map(c => [c, {}])),
        };
      } else {
        const item = inventoryMap[key];
        if (row[COL.name]) item.productName = row[COL.name];
        if (row[COL.size]) item.sizeName = row[COL.size];
        if (row[COL.year]) item.year = row[COL.year];
        if (row[COL.price]) item.price = row[COL.price];
      }

      const inventory = parseInt(row[COL.inventory]) || 0;
      const category = resolveCategory(productCode, table.name, warehouseMapping, categoryRules);
      const bucket = inventoryMap[key].byCategory[category];
      if (bucket) bucket[table.name] = inventory;
    });
  });

  const sumOf = (bucket) => Object.values(bucket).reduce((sum, n) => sum + n, 0);
  const items = Object.values(inventoryMap).map(item => {
    const sums = {};
    CATEGORIES.forEach(c => { sums[c] = sumOf(item.byCategory[c]); });
    return { ...item, ...sums };
  });

  // 年度倒序 → 同年度依商品代號自然排序
  items.sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    if (yearA !== yearB) return yearB - yearA;
    return a.productCode.toString().localeCompare(b.productCode.toString(), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });

  return items;
};

// 依版本產生輸出欄位（順序即輸出順序）。品牌欄只在品牌別版本出現。
export const buildColumns = (version) => {
  const columns = [
    { key: '商品代號', width: 17 },
    { key: '商品名稱', width: 25 },
    { key: '貨號', width: 17 },
    { key: '尺寸名稱', width: 15 },
    { key: '年度', width: 10 },
    { key: '含稅定價', width: 12 },
    ...CATEGORIES.map(c => ({ key: c, width: 10 })),
  ];
  if (version === '品牌別') columns.push({ key: '品牌', width: 14 });
  columns.push({ key: '備註', width: 20 });
  return columns;
};

// 單一 summary item + 欄位 key → 顯示值。畫面預覽與匯出 Excel 共用，確保兩邊一致。
export const cellValue = (item, key) => {
  switch (key) {
    case '商品代號': return item.productCode;
    case '商品名稱': return item.productName || '';
    case '貨號': return getItemNumber(item.productCode);
    case '尺寸名稱': return item.sizeName || '';
    case '年度': return item.year || '';
    case '含稅定價': return item.price || '';
    case '品牌': return item.brand || '';
    case '備註': return '';
    // 庫別欄：數量為 0 時留白，與紙本庫存表格式一致
    default: return item[key] || '';
  }
};
