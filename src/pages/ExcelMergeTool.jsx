import React, { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, Plus, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';


const ExcelMergeTool = () => {
  const [sourceFile, setSourceFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);
  const [mappingErrors, setMappingErrors] = useState([]);
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
        // else if (tableName.includes('總倉')) sourceType = '總倉';
        
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

  // 處理模板檔案上傳
  const handleTemplateFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 自動偵測標題行
        let headerRowIndex = 0;
        let headers = [];
        
        for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
          const row = jsonData[i];
          if (row && row.length > 0) {
            const rowStr = row.join('').toLowerCase();
            if (rowStr.includes('商品代號') || rowStr.includes('商品名稱')) {
              headers = row.map(cell => cell ? String(cell).trim() : '');
              headerRowIndex = i;
              break;
            }
          }
        }
        
        if (headers.length === 0) {
          headers = jsonData[0] || [];
          headerRowIndex = 0;
        }
        
        const data = jsonData.slice(headerRowIndex + 1).filter(row => 
          row && row.length > 0 && row[0] && row[0].toString().trim() !== ''
        );
        
        setTemplateFile({
          id: Date.now(),
          name: file.name,
          headers,
          data,
          rawData: jsonData,
          headerRow: headerRowIndex
        });
        
        // 分析欄位對應
        analyzeTemplateColumnMapping(headers);
        
      } catch (error) {
        alert(`讀取模板檔案時發生錯誤: ${error.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // 分析模板欄位對應
  const analyzeTemplateColumnMapping = (headers) => {
    const mapping = {};
    const errors = [];
    
    headers.forEach((header, index) => {
      const headerClean = header.trim();
      
      if (headerClean.includes('商品代號') || headerClean.includes('代號')) {
        mapping.productCode = { index, name: header, sourceCol: 'A' };
      } else if (headerClean.includes('商品名稱') || headerClean.includes('名稱')) {
        mapping.productName = { index, name: header, sourceCol: 'B' };
      } else if (headerClean.includes('尺寸') || headerClean.includes('尺寸名稱')) {
        mapping.sizeName = { index, name: header, sourceCol: 'P' };
      } else if (headerClean.includes('年度')) {
        mapping.year = { index, name: header, sourceCol: 'N' };
      } else if (headerClean.includes('總倉')) {
        mapping.warehouse = { index, name: header, sourceCol: '總倉表格' };
      } else if (headerClean.includes('官網')) {
        mapping.website = { index, name: header, sourceCol: '官網表格' };
      } else if (headerClean.includes('平台') || headerClean.includes('平臺')) {
        mapping.platform = { index, name: header, sourceCol: '平台表格' };
      } else if (headerClean.includes('含稅定價') || headerClean.includes('定價')) {
        mapping.price = { index, name: header, sourceCol: 'M' };
      } else if (headerClean.includes('備註')) {
        mapping.notes = { index, name: header, sourceCol: '手動填入' };
      }
    });
    
    // 檢查必要欄位
    const requiredFields = [
      { key: 'productCode', name: '商品代號' },
      { key: 'productName', name: '商品名稱' },
      { key: 'warehouse', name: '總倉' },
      { key: 'website', name: '官網' },
      { key: 'platform', name: '平台' }
    ];
    
    requiredFields.forEach(field => {
      if (!mapping[field.key]) {
        errors.push(`找不到「${field.name}」欄位`);
      }
    });
    
    setColumnMapping(mapping);
    setMappingErrors(errors);
  };

  // 處理資料合併
  const processInventoryData = () => {
    if (!templateFile || !sourceFile) {
      alert('請先上傳模板檔案和來源檔案');
      return;
    }

    if (mappingErrors.length > 0) {
      alert('請先解決欄位對應問題：\n' + mappingErrors.join('\n'));
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
          const seasonName = row[16]; // Q欄 - 季節名稱
          
          if (productCode) {
            const key = `${productCode}`;
            if (!inventoryMap[key]) {
              inventoryMap[key] = {
                productCode,
                productName,
                sizeName,
                seasonName,
                year,
                price,
                總倉: 0,
                官網: 0,
                平台: 0
              };
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

      // 基於模板創建結果
      const resultData = templateFile.data.map(row => {
        const newRow = [...row];
        const productCode = row[columnMapping.productCode?.index];
        
        if (productCode && inventoryMap[productCode]) {
          const inventory = inventoryMap[productCode];
          
          // 更新各欄位
          if (columnMapping.productName) {
            newRow[columnMapping.productName.index] = inventory.productName || newRow[columnMapping.productName.index];
          }
          if (columnMapping.sizeName) {
            newRow[columnMapping.sizeName.index] = inventory.sizeName || newRow[columnMapping.sizeName.index];
          }
          if (columnMapping.year) {
            newRow[columnMapping.year.index] = inventory.year || newRow[columnMapping.year.index];
          }
          if (columnMapping.price) {
            newRow[columnMapping.price.index] = inventory.price || newRow[columnMapping.price.index];
          }
          if (columnMapping.warehouse) {
            newRow[columnMapping.warehouse.index] = inventory.總倉;
          }
          if (columnMapping.website) {
            newRow[columnMapping.website.index] = inventory.官網;
          }
          if (columnMapping.platform) {
            newRow[columnMapping.platform.index] = inventory.平台;
          }
          if (columnMapping.seasonName) {
            newRow[columnMapping.seasonName.index] = inventory.seasonName || newRow[columnMapping.seasonName.index];
          }
        }
        
        return newRow;
      });

      setProcessedData({
        headers: templateFile.headers,
        data: resultData,
        summary: Object.values(inventoryMap),
        extractedTables: extractedTables
      });
      
    } catch (error) {
      alert(`處理資料時發生錯誤: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 匯出Excel檔案
  const exportToExcel = () => {
    if (!processedData) return;
    
    const wb = XLSX.utils.book_new();
    
    // 完整庫存表工作表
    // const fullData = [processedData.headers, ...processedData.data];
    // const inventoryWS = XLSX.utils.aoa_to_sheet(fullData);
    // XLSX.utils.book_append_sheet(wb, inventoryWS, '更新後庫存表');
    
    // 匯總工作表 - 修正屬性對應
    const summaryData = processedData.summary.map(item => ({
      商品代號: item.productCode,
      商品名稱: item.productName,
      尺寸名稱: item.sizeName || '',
      季節名稱: item.seasonName || '',
      年度: item.year,
      總倉: item.總倉,
      官網: item.官網,
      平台: item.平台,
      含稅定價: item.price,
      備註: ''
    }));
    const summaryWS = XLSX.utils.json_to_sheet(summaryData);

    // === 新增欄寬設定 ===
    summaryWS['!cols'] = [
      { wch: 17 }, // 商品代號
      { wch: 25 }, // 商品名稱
      { wch: 15 }, // 尺寸名稱
      { wch: 12 },  // 季節名稱
      { wch: 10 }, // 年度
      { wch: 10 }, // 總倉
      { wch: 10 }, // 官網
      { wch: 10 }, // 平台
      { wch: 12 }, // 含稅定價
      { wch: 20 } // 備註
    ];

    // === 設定標題列樣式 === <sheetJS不支援樣式設定>
    const range = XLSX.utils.decode_range(summaryWS['!ref']); // 取得工作表範圍
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C }); // 標題列第 0 列
      if (!summaryWS[cellAddress]) continue;

      // 設定樣式：加粗 + 灰色背景
      summaryWS[cellAddress].s = {
        font: { bold: true, color: { rgb: "000000" } },
        fill: {
          patternType: "solid",
          fgColor: { rgb: "D9D9D9" } // 淺灰色背景
        },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

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
        
        {/* 模板檔案上傳 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            上傳庫存表模板檔案
          </label>
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleTemplateFileUpload}
              className="hidden"
              id="template-upload"
            />
            <label htmlFor="template-upload" className="cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-blue-400 mb-2" />
              <span className="text-blue-600 hover:text-blue-800">選擇庫存表模板</span>
            </label>
          </div>
          {templateFile && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800 flex justify-between items-center">
              <span>已上傳：{templateFile.name}</span>
              <button
                onClick={() => setPreviewMode(previewMode === 'template' ? null : 'template')}
                className="text-blue-600 hover:text-blue-800 text-xs border rounded px-2 py-1"
              >
                {previewMode === 'template' ? '隱藏預覽' : '預覽模板'}
              </button>
            </div>
          )}
        </div>

        {/* 模板欄位對應分析 */}
        {columnMapping && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">模板欄位對應分析</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">找到的欄位：</h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(columnMapping).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{value.name}:</span>
                        <span className="text-gray-600">第{value.index + 1}欄 ← {value.sourceCol}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">預期欄位對應：</h4>
                  <div className="text-xs space-y-1 text-gray-600">
                    <div>A/商品代號 → 模板商品代號欄</div>
                    <div>B/商品名稱 → 模板商品名稱欄</div>
                    <div>P/尺寸名稱 → 模板尺寸名稱欄</div>
                    <div>N/年度 → 模板年度欄</div>
                    <div>M/含稅定價 → 模板含稅定價欄</div>
                    <div>L/可售量 → 模板總倉/官網/平台欄</div>
                  </div>
                </div>
              </div>
              
              {mappingErrors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-red-500 mt-0.5" size={16} />
                    <div>
                      <h4 className="font-medium text-red-700">欄位對應問題：</h4>
                      <ul className="text-sm text-red-600 mt-1">
                        {mappingErrors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
        {previewMode === 'template' && templateFile && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">模板預覽 (前5行)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    {templateFile.headers.map((header, index) => (
                      <th key={index} className="border px-2 py-1">{index + 1}. {header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templateFile.data.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {templateFile.headers.map((_, colIndex) => (
                        <td key={colIndex} className="border px-2 py-1">{row[colIndex] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                          <td className="border px-2 py-1">{rowData.data[10] || ''}</td>
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
        {templateFile && sourceFile && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={processInventoryData}
              disabled={loading || mappingErrors.length > 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus size={16} />
              {loading ? '處理中...' : '更新庫存表'}
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
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">尺寸</th>
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
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.總倉}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.官網}</td>
                        <td className="px-2 py-2 text-sm text-gray-900 text-right">{item.平台}</td>
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