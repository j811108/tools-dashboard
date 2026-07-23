import React, { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

// 制式輸出模板欄位（順序即輸出順序）
const OUTPUT_COLUMNS = [
  { key: '商品代號', width: 17 },
  { key: '商品名稱', width: 25 },
  { key: '貨號', width: 17 },
  { key: '尺寸名稱', width: 15 },
  { key: '年度', width: 10 },
  { key: '含稅定價', width: 12 },
  { key: '總倉', width: 10 },
  { key: '官網', width: 10 },
  { key: '平台', width: 10 },
  { key: '展威', width: 10 },
  { key: '備註', width: 20 },
];

// 貨號：商品代號有兩個 - 才取，SG 開頭取前 12 字，其餘取前 13 字
const getItemNumber = (productCode) => {
  const code = productCode?.toString() ?? '';
  if (code.split('-').length - 1 !== 2) return '';
  return code.slice(0, code.startsWith('SG') ? 12 : 13);
};

// 倉庫名稱 → 輸出欄位。先命中先算，順序不可調換：
// 「展威麗嬰房(平台總倉)」同時含「平台」「總倉」，不先攔會被判成平台；
// 「展宇麗嬰(平台總倉)」同時含「平台」「總倉」，要判成平台而非總倉。
const resolveSourceType = (warehouseName) => {
  const name = warehouseName?.toString() ?? '';
  if (name.includes('展威')) return '展威';
  if (name.includes('平台') || name.includes('平臺')) return '平台';
  if (name.includes('電商') || name.includes('官網')) return '官網';
  return '總倉';  //1140922 未知一律丟總倉
};

// 解析單一檔案的表格區塊
const parseTableBlocks = (jsonData, fileName) => {
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
const readSourceFile = (file) =>
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

const ExcelMergeTool = () => {
  const [sourceFiles, setSourceFiles] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedTables, setExtractedTables] = useState([]);
  const [previewMode, setPreviewMode] = useState(null);
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/");
  };

  // 處理來源檔案上傳（可一次選多檔，也可分次累加）
  const handleSourceFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';  // 清空才能重選同一個檔案
    if (files.length === 0) return;

    setProcessedData(null);
    setPreviewMode(null);
    setLoading(true);

    try {
      // 同檔名只收一次，避免同一份庫存被重複累加
      const existingNames = new Set(sourceFiles.map(f => f.name));
      const accepted = [];
      const skipped = [];

      // 逐檔依序讀取，全部讀完才更新 state
      for (const file of files) {
        if (existingNames.has(file.name)) {
          skipped.push(file.name);
          continue;
        }
        existingNames.add(file.name);
        accepted.push(await readSourceFile(file));
      }

      if (accepted.length > 0) {
        setSourceFiles(prev => [
          ...prev,
          ...accepted.map(r => ({ id: `${r.name}-${Date.now()}`, name: r.name, blockCount: r.tables.length }))
        ]);
        setExtractedTables(prev => [...prev, ...accepted.flatMap(r => r.tables)]);
      }
      if (skipped.length > 0) {
        alert(`以下檔案已經上傳過，這次略過（避免庫存重複累加）：\n${skipped.join('\n')}`);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }, [sourceFiles]);

  // 移除單一來源檔（連同它解析出來的區塊）
  const handleRemoveFile = (name) => {
    setSourceFiles(prev => prev.filter(f => f.name !== name));
    setExtractedTables(prev => prev.filter(t => t.fileName !== name));
    setProcessedData(null);
  };

  // 清除所有已上傳的檔案與結果
  const handleClearAll = () => {
    setSourceFiles([]);
    setExtractedTables([]);
    setProcessedData(null);
    setPreviewMode(null);
  };

  // 處理資料合併
  const processInventoryData = () => {
    if (sourceFiles.length === 0) {
      alert('請先上傳來源檔案');
      return;
    }

    if (extractedTables.length === 0) {
      alert('未能從來源檔案中提取到有效的表格資料');
      return;
    }

    setLoading(true);

    try {
      // 創建商品庫存映射表
      const inventoryMap = {};

      // 處理每個表格區塊
      extractedTables.forEach(table => {
        table.dataRows.forEach(rowData => {
          const row = rowData.data;
          const productCode = row[0]; // A欄 - 商品代號
          const productName = row[1]; // B欄 - 商品名稱
          const sizeName = row[15]; // P欄 - 尺寸名稱
          const year = row[13]; // N欄 - 年度
          const price = row[12]; // M欄 - 含稅定價
          const inventory = parseInt(row[11]) || 0; // L欄 - 可售量

          if (productCode) {
            const key = `${productCode}`;
            if (!inventoryMap[key]) {
              inventoryMap[key] = {
                productCode,
                productName,
                sizeName,
                year,
                price,
                // 每個輸出欄位底下再依「原始倉庫名稱」分別記錄：
                // 同一倉庫重複出現（分頁）→ 覆蓋，不會重複累加；
                // 不同倉庫落在同一欄位（例：展威麗嬰房 + 展威麗嬰房(平台總倉)）→ 相加。
                byWarehouse: { 總倉: {}, 官網: {}, 平台: {}, 展威: {} }
              };
            } else {
              if (productName) inventoryMap[key].productName = productName;
              if (sizeName) inventoryMap[key].sizeName = sizeName;
              if (year) inventoryMap[key].year = year;
              if (price) inventoryMap[key].price = price;
            }

            const bucket = inventoryMap[key].byWarehouse[table.sourceType];
            if (bucket) bucket[table.name] = inventory;
          }
        });
      });

      // 把各倉庫的數量加總成輸出欄位
      const sumOf = (bucket) => Object.values(bucket).reduce((sum, n) => sum + n, 0);
      Object.values(inventoryMap).forEach(item => {
        item.總倉 = sumOf(item.byWarehouse.總倉);
        item.官網 = sumOf(item.byWarehouse.官網);
        item.平台 = sumOf(item.byWarehouse.平台);
        item.展威 = sumOf(item.byWarehouse.展威);
      });

      // 將 inventoryMap 轉為陣列，先按年度倒序排列，再按商品代號排序
      const sortedSummary = Object.values(inventoryMap).sort((a, b) => {
        // 先比較年度（倒序）
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;

        if (yearA !== yearB) {
          return yearB - yearA; // 年度大的排在前面（倒序）
        }

        // 年度相同時，按商品代號排序（使用自然排序）
        return a.productCode.toString().localeCompare(b.productCode.toString(), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      setProcessedData({
        summary: sortedSummary,
        extractedTables: extractedTables
      });

    } catch (error) {
      alert(`處理資料時發生錯誤: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 匯出Excel檔案（制式模板）
  const exportToExcel = () => {
    if (!processedData) return;

    const wb = XLSX.utils.book_new();

    const summaryData = processedData.summary.map(item => ({
      商品代號: item.productCode,
      商品名稱: item.productName || '',
      貨號: getItemNumber(item.productCode),
      尺寸名稱: item.sizeName || '',
      年度: item.year || '',
      含稅定價: item.price || '',
      // 數量為 0 時留白，與紙本庫存表格式一致
      總倉: item.總倉 || '',
      官網: item.官網 || '',
      平台: item.平台 || '',
      展威: item.展威 || '',
      備註: ''
    }));

    const summaryWS = XLSX.utils.json_to_sheet(summaryData, {
      header: OUTPUT_COLUMNS.map(col => col.key)
    });
    summaryWS['!cols'] = OUTPUT_COLUMNS.map(col => ({ wch: col.width }));

    XLSX.utils.book_append_sheet(wb, summaryWS, '庫存匯總');

    // 生成檔案名稱，加上日期
    const today = new Date();
    const yymmdd = today.getFullYear().toString().slice(-2) +
                   (today.getMonth() + 1).toString().padStart(2, '0') +
                   today.getDate().toString().padStart(2, '0');
    // 單檔沿用來源檔名；多檔改標示合併檔數，避免誤以為只含其中一份
    const baseName = sourceFiles.length === 1
      ? sourceFiles[0].name.split('.')[0]
      : `合併${sourceFiles.length}檔`;
    const fileName = `庫存表_${baseName}_${yymmdd}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBackToHome}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回工具首頁
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              庫存表
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileSpreadsheet className="text-blue-600" />
          庫存表更新工具 - 多表格區塊版本
        </h1>

        {/* 來源檔案上傳 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            上傳庫存來源檔案（可一次選多個檔案，或分次上傳累加；系統會自動辨識每個檔案裡的倉庫區塊並合併成一份）
          </label>
          <div className="border-2 border-dashed border-green-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
            <label className="cursor-pointer block">
              <Upload className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <span className="text-green-600 hover:text-green-800">選擇庫存來源檔案 (可多選)</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleSourceFileUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          {loading && (
            <div className="mt-3 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
              <span className="ml-3 text-sm text-gray-600">處理中...</span>
            </div>
          )}

          {sourceFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-sm text-green-600">✅ 已上傳 {sourceFiles.length} 個檔案</div>
              {sourceFiles.map(file => (
                <div key={file.id} className="p-2 bg-green-50 rounded text-sm text-green-800 flex justify-between items-center">
                  <span>{file.name}（{file.blockCount} 個倉庫區塊）</span>
                  <button
                    onClick={() => handleRemoveFile(file.name)}
                    className="text-red-600 hover:text-red-800 text-xs border border-red-200 rounded px-2 py-1"
                  >
                    移除
                  </button>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPreviewMode(previewMode === 'source' ? null : 'source')}
                  className="text-green-600 hover:text-green-800 text-xs border rounded px-2 py-1"
                >
                  {previewMode === 'source' ? '隱藏預覽' : '預覽表格'}
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex items-center text-red-600 hover:text-red-800 text-xs border border-red-200 rounded px-2 py-1"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清除所有
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 輸出格式說明 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">輸出格式（制式模板）</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="overflow-x-auto">
              <table className="text-xs border bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    {OUTPUT_COLUMNS.map(col => (
                      <th key={col.key} className="border px-2 py-1 whitespace-nowrap">{col.key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 欄位順序與數量必須與 OUTPUT_COLUMNS 一致 */}
                  <tr className="text-gray-500">
                    <td className="border px-2 py-1 whitespace-nowrap">2023GWP01-F</td>
                    <td className="border px-2 py-1 whitespace-nowrap">托特包</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">F</td>
                    <td className="border px-2 py-1">2023</td>
                    <td className="border px-2 py-1">1080</td>
                    <td className="border px-2 py-1">19</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">3</td>
                    <td className="border px-2 py-1">1</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                  <tr className="text-gray-500">
                    <td className="border px-2 py-1 whitespace-nowrap">SG2024-ABC-01</td>
                    <td className="border px-2 py-1 whitespace-nowrap">範例商品</td>
                    <td className="border px-2 py-1 whitespace-nowrap">SG2024-ABC-</td>
                    <td className="border px-2 py-1">356</td>
                    <td className="border px-2 py-1">2024</td>
                    <td className="border px-2 py-1">900</td>
                    <td className="border px-2 py-1">40</td>
                    <td className="border px-2 py-1">19</td>
                    <td className="border px-2 py-1">33</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-600 mt-3 space-y-1">
              <div>A/商品代號、B/商品名稱、P/尺寸名稱、N/年度、M/含稅定價 → 直接取自來源檔案</div>
              <div>L/可售量 → 依表格區塊分別填入 總倉 / 官網 / 平台 / 展威</div>
              <div>倉庫對應：含「展威」→ 展威；含「平台」→ 平台；含「電商 / 官網」→ 官網；其餘 → 總倉</div>
              <div>可一次上傳多個檔案（例：主庫存檔 + 展威檔），會合併成一份輸出；沒有庫存的欄位留白</div>
              <div>備註 → 一律留白，供人工填寫</div>
            </div>
          </div>
        </div>

        {/* 提取的表格區塊顯示 */}
        {extractedTables.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">提取的表格區塊</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {extractedTables.map((table, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-800 mb-1">{table.sourceType}</div>
                  <div className="text-xs text-gray-500 mb-1 break-all">
                    <div>倉庫：{table.name || '（無名稱）'}</div>
                    <div>檔案：{table.fileName}</div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>名稱行: 第{table.nameRow + 1}行</div>
                    <div>標題行: 第{table.headerRow + 1}行</div>
                    <div>資料行: {table.dataRows.length}行</div>
                    {table.summaryRow !== -1 && <div>統計行: 第{table.summaryRow + 1}行</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 預覽區域 */}
        {previewMode === 'source' && extractedTables.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">來源表格預覽</h4>
            {extractedTables.map((table, tableIndex) => (
              <div key={tableIndex} className="mb-4">
                <h5 className="font-medium text-gray-700 mb-1">
                  {table.sourceType}｜{table.name}｜{table.fileName}（前3行資料）
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1">A-商品代號</th>
                        <th className="border px-2 py-1">B-商品名稱</th>
                        <th className="border px-2 py-1">L-可售量</th>
                        <th className="border px-2 py-1">M-含稅定價</th>
                        <th className="border px-2 py-1">N-年度</th>
                        <th className="border px-2 py-1">P-尺寸名稱</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.dataRows.slice(0, 3).map((rowData, rowIndex) => (
                        <tr key={rowIndex}>
                          <td className="border px-2 py-1">{rowData.data[0] || ''}</td>
                          <td className="border px-2 py-1">{rowData.data[1] || ''}</td>
                          <td className="border px-2 py-1">{rowData.data[11] || ''}</td>
                          <td className="border px-2 py-1">{rowData.data[12] || ''}</td>
                          <td className="border px-2 py-1">{rowData.data[13] || ''}</td>
                          <td className="border px-2 py-1">{rowData.data[15] || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 處理按鈕 */}
        {sourceFiles.length > 0 && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={processInventoryData}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={16} />
              {loading ? '處理中...' : '產生庫存表'}
            </button>
          </div>
        )}

        {/* 結果顯示 */}
        {processedData && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">處理結果</h3>
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={16} />
                匯出Excel
              </button>
            </div>

            {/* 庫存匯總預覽 */}
            <div className="bg-white border rounded-lg overflow-hidden mb-4">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h4 className="font-medium">庫存匯總預覽 (前10項)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">商品代號</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">商品名稱</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">貨號</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">尺寸名稱</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">年度</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">含稅定價</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">總倉</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">官網</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">平台</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">展威</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.summary.slice(0, 10).map((item, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 text-sm font-medium text-gray-900">{item.productCode}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.productName}</td>
                        <td className="px-2 py-2 text-sm font-medium text-gray-900">{getItemNumber(item.productCode)}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.sizeName}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.year}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.price}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.總倉 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.官網 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.平台 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.展威 || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 統計資訊 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                成功處理了 <span className="font-semibold">{processedData.summary.length}</span> 項商品的庫存資料，
                從 <span className="font-semibold">{sourceFiles.length}</span> 個檔案、
                <span className="font-semibold">{processedData.extractedTables.length}</span> 個倉庫區塊中提取資料
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelMergeTool;
