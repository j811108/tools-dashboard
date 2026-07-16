import React, { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';

// 制式輸出模板欄位（順序即輸出順序）
const OUTPUT_COLUMNS = [
  { key: '商品代號', width: 17 },
  { key: '商品名稱', width: 25 },
  { key: '尺寸名稱', width: 15 },
  { key: '年度', width: 10 },
  { key: '總倉', width: 10 },
  { key: '官網', width: 10 },
  { key: '平台', width: 10 },
  { key: '含稅定價', width: 12 },
  { key: '備註', width: 20 },
];

const ExcelMergeTool = () => {
  const [sourceFile, setSourceFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedTables, setExtractedTables] = useState([]);
  const [previewMode, setPreviewMode] = useState(null);
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/");
  };

  // 處理來源檔案上傳
  const handleSourceFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProcessedData(null);
    setPreviewMode(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        setSourceFile({
          id: Date.now(),
          name: file.name,
          rawData: jsonData
        });

        // 自動解析表格區塊
        parseTableBlocks(jsonData);

      } catch (error) {
        alert(`讀取檔案 ${file.name} 時發生錯誤: ${error.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // 解析表格區塊
  const parseTableBlocks = (jsonData) => {
    const tables = [];
    let currentTable = null;

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const rowText = row.join('').toLowerCase();

      // 檢查是否為表格名稱行
      if (rowText.includes('展') || rowText.includes('總倉') || rowText.includes('電商') || rowText.includes('平台') ||
          rowText.includes('官網') || rowText.includes('倉庫')) {
        // 保存前一個表格
        if (currentTable && currentTable.dataRows.length > 0) {
          tables.push(currentTable);
        }

        // 開始新表格
        const tableName = row[0] || '';
        let sourceType = '總倉';  //1140922 未知一律丟總倉
        if (tableName.includes('平台') || tableName.includes('平臺')) sourceType = '平台';
        else if (tableName.includes('電商') || tableName.includes('官網')) sourceType = '官網';

        currentTable = {
          name: tableName,
          sourceType: sourceType,
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

    setExtractedTables(tables);
  };

  // 處理資料合併
  const processInventoryData = () => {
    if (!sourceFile) {
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
                總倉: 0,
                官網: 0,
                平台: 0
              };
            } else {
              if (productName) inventoryMap[key].productName = productName;
              if (sizeName) inventoryMap[key].sizeName = sizeName;
              if (year) inventoryMap[key].year = year;
              if (price) inventoryMap[key].price = price;
            }

            // 根據表格來源類型設定庫存
            if (table.sourceType === '總倉') {
              inventoryMap[key].總倉 = inventory;
            } else if (table.sourceType === '官網') {
              inventoryMap[key].官網 = inventory;
            } else if (table.sourceType === '平台') {
              inventoryMap[key].平台 = inventory;
            }
          }
        });
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
      尺寸名稱: item.sizeName || '',
      年度: item.year || '',
      // 數量為 0 時留白，與紙本庫存表格式一致
      總倉: item.總倉 || '',
      官網: item.官網 || '',
      平台: item.平台 || '',
      含稅定價: item.price || '',
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
    const fileName = `更新後庫存表_${yymmdd}.xlsx`;

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
            上傳庫存來源檔案（包含總倉/電商/平台三個表格區塊）
          </label>
          <div className="border-2 border-dashed border-green-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleSourceFileUpload}
              className="hidden"
              id="source-upload"
            />
            <label htmlFor="source-upload" className="cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <span className="text-green-600 hover:text-green-800">選擇庫存來源檔案</span>
            </label>
          </div>
          {sourceFile && (
            <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-800 flex justify-between items-center">
              <span>已上傳：{sourceFile.name}</span>
              <button
                onClick={() => setPreviewMode(previewMode === 'source' ? null : 'source')}
                className="text-green-600 hover:text-green-800 text-xs border rounded px-2 py-1"
              >
                {previewMode === 'source' ? '隱藏預覽' : '預覽表格'}
              </button>
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
                  <tr className="text-gray-500">
                    <td className="border px-2 py-1 whitespace-nowrap">2023GWP01-F</td>
                    <td className="border px-2 py-1 whitespace-nowrap">托特包</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">2023</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">19</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">1080</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-600 mt-3 space-y-1">
              <div>A/商品代號、B/商品名稱、P/尺寸名稱、N/年度、M/含稅定價 → 直接取自來源檔案</div>
              <div>L/可售量 → 依表格區塊分別填入 總倉 / 官網 / 平台</div>
              <div>備註 → 一律留白，供人工填寫</div>
            </div>
          </div>
        </div>

        {/* 提取的表格區塊顯示 */}
        {extractedTables.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">提取的表格區塊</h3>
            <div className="grid grid-cols-3 gap-4">
              {extractedTables.map((table, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-800 mb-1">{table.sourceType}</div>
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
                <h5 className="font-medium text-gray-700 mb-1">{table.sourceType} (前3行資料)</h5>
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
        {sourceFile && (
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
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">尺寸名稱</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">年度</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">總倉</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">官網</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">平台</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">含稅定價</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.summary.slice(0, 10).map((item, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 text-sm font-medium text-gray-900">{item.productCode}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.productName}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.sizeName}</td>
                        <td className="px-2 py-2 text-sm text-gray-900">{item.year}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.總倉 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.官網 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.平台 || ''}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.price}</td>
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
                從 <span className="font-semibold">{processedData.extractedTables.length}</span> 個表格區塊中提取資料
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelMergeTool;
