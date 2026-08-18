import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import HelpModal from "../components/HelpModal";
import ToolHeader from "../components/ToolHeader";
import { HELP_DOCS } from '../data/helpDocs';
import {
  CATEGORIES,
  resolveSourceType,
  readSourceFile,
  detectCodePrefixes,
  buildSummary,
  buildColumns,
  cellValue,
} from '../utils/inventoryUtils';

const VERSIONS = ['倉庫別', '品牌別'];
let ruleSeq = 0;  // 給動態規則列一個穩定 key
const newRule = (extra) => ({ id: `r${++ruleSeq}`, prefix: '', ...extra });

// 輸出格式示意列（依 column key 取值，沒對到的欄位留白；庫別欄示意數量）
const EXAMPLE_ROW = {
  商品代號: '4000016-0001U-356',
  商品名稱: 'Color',
  貨號: '4000016-0001U',
  尺寸名稱: '356',
  年度: '2027',
  含稅定價: '900',
  總倉: '40',
  官網: '19',
  平台: '33',
  展威: '1',
  品牌: '麗嬰',
};

const ExcelMergeTool = () => {
  const [sourceFiles, setSourceFiles] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedTables, setExtractedTables] = useState([]);
  const [previewMode, setPreviewMode] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // 設定面板狀態
  const [outputVersion, setOutputVersion] = useState('倉庫別');
  const [warehouseMapping, setWarehouseMapping] = useState({});           // 倉庫名 → 庫別
  const [categoryRules, setCategoryRules] = useState([]);                  // 貨號開頭 → 庫別（可凌駕）
  const [brandRules, setBrandRules] = useState([]);                        // 貨號開頭 → 品牌

  // 偵測到的倉庫（依解析結果，保留使用者已改的對應）
  useEffect(() => {
    const names = [...new Set(extractedTables.map(t => t.name))];
    setWarehouseMapping(prev => {
      const next = {};
      names.forEach(n => { next[n] = prev[n] || resolveSourceType(n); });
      return next;
    });
    setProcessedData(null);
  }, [extractedTables]);

  const detectedPrefixes = useMemo(() => detectCodePrefixes(extractedTables), [extractedTables]);
  const columns = useMemo(() => buildColumns(outputVersion), [outputVersion]);

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

  // 設定面板操作
  const updateWarehouseCategory = (name, category) => {
    setWarehouseMapping(prev => ({ ...prev, [name]: category }));
    setProcessedData(null);
  };
  const updateRule = (setRules, id, patch) => {
    setRules(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    setProcessedData(null);
  };
  const removeRule = (setRules, id) => {
    setRules(prev => prev.filter(r => r.id !== id));
    setProcessedData(null);
  };

  // 處理資料合併（庫別指派邏輯集中在 inventoryUtils.buildSummary）
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
      const summary = buildSummary(extractedTables, { warehouseMapping, categoryRules, brandRules });
      setProcessedData({ summary, extractedTables });
    } catch (error) {
      alert(`處理資料時發生錯誤: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 匯出Excel檔案（欄位與畫面預覽共用 columns / cellValue）
  const exportToExcel = () => {
    if (!processedData) return;

    const wb = XLSX.utils.book_new();

    const summaryData = processedData.summary.map(item =>
      Object.fromEntries(columns.map(col => [col.key, cellValue(item, col.key)]))
    );

    const summaryWS = XLSX.utils.json_to_sheet(summaryData, {
      header: columns.map(col => col.key)
    });
    summaryWS['!cols'] = columns.map(col => ({ wch: col.width }));

    XLSX.utils.book_append_sheet(wb, summaryWS, '庫存匯總');

    // 生成檔案名稱，加上版本與日期
    const today = new Date();
    const yymmdd = today.getFullYear().toString().slice(-2) +
                   (today.getMonth() + 1).toString().padStart(2, '0') +
                   today.getDate().toString().padStart(2, '0');
    // 單檔沿用來源檔名；多檔改標示合併檔數，避免誤以為只含其中一份
    const baseName = sourceFiles.length === 1
      ? sourceFiles[0].name.split('.')[0]
      : `${sourceFiles[0].name.split('.')[0]} 合併${sourceFiles.length}檔`;
    const fileName = `庫存表_${baseName}_${outputVersion}_${yymmdd}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <ToolHeader title="庫存表" onHelp={() => setShowHelp(true)} />

      <HelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        title={HELP_DOCS['excel-merge-tool'].title}
        content={HELP_DOCS['excel-merge-tool'].content}
      />

      <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 py-10">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 sm:p-8 mb-6">
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
          <h3 className="text-lg font-semibold text-gray-800 mb-3">輸出格式（{outputVersion}）</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="overflow-x-auto">
              <table className="text-xs border bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    {columns.map(col => (
                      <th key={col.key} className="border px-2 py-1 whitespace-nowrap">{col.key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 範例列由 columns 推導，欄位永遠對齊 */}
                  <tr className="text-gray-500">
                    {columns.map(col => (
                      <td key={col.key} className="border px-2 py-1 whitespace-nowrap">
                        {EXAMPLE_ROW[col.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-600 mt-3 space-y-1">
              <div>A/商品代號、B/商品名稱、P/尺寸名稱、N/年度、M/含稅定價 → 直接取自來源檔案</div>
              <div>L/可售量 → 依「倉庫對應庫別」與「貨號覆蓋規則」填入 {CATEGORIES.join(' / ')}</div>
              <div>可一次上傳多個檔案（例：主庫存檔 + 展威檔），會合併成一份輸出；沒有庫存的欄位留白</div>
              <div>品牌別版本會在庫別欄後多一欄「品牌」（依貨號對應品牌）方便篩選；備註一律留白供人工填寫</div>
            </div>
          </div>
        </div>

        {/* 設定面板（解析後才出現）：版本、倉庫對應、貨號覆蓋、貨號品牌 */}
        {extractedTables.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* 版本選擇 */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">產出版本：</span>
              {VERSIONS.map(v => (
                <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="outputVersion"
                    checked={outputVersion === v}
                    onChange={() => setOutputVersion(v)}
                  />
                  {v}{v === '品牌別' && '（多一欄品牌）'}
                </label>
              ))}
            </div>

            {/* 倉庫對應庫別 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-1">倉庫對應庫別</h4>
              <p className="text-xs text-gray-500 mb-3">依偵測到的倉庫自動帶入預設庫別，可用下拉調整。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(warehouseMapping).map(name => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 break-all text-gray-700">{name}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={warehouseMapping[name]}
                      onChange={(e) => updateWarehouseCategory(name, e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* 貨號 → 庫別 覆蓋規則 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-gray-800">貨號對應庫別（覆蓋規則）</h4>
                <button
                  onClick={() => setCategoryRules(prev => [...prev, newRule({ category: CATEGORIES[0], override: true })])}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm border border-blue-200 rounded px-2 py-1"
                >
                  <Plus className="h-3 w-3 mr-1" />新增
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                勾「凌駕」時，貨號開頭命中的商品整列改用指定庫別（不管來自哪個倉庫）；不勾則不生效。沒設定就只看上方倉庫對應。
                {detectedPrefixes.length > 0 && <>本次檔案貨號開頭：<span className="font-mono">{detectedPrefixes.join('、')}</span></>}
              </p>
              {categoryRules.length === 0 && <p className="text-xs text-gray-400">尚無規則</p>}
              <div className="space-y-2">
                {categoryRules.map(rule => (
                  <div key={rule.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-gray-500">貨號開頭</span>
                    <input
                      type="text"
                      value={rule.prefix}
                      onChange={(e) => updateRule(setCategoryRules, rule.id, { prefix: e.target.value })}
                      placeholder="如 4、HV"
                      className="border rounded px-2 py-1 w-24 font-mono"
                    />
                    <span className="text-gray-400">→</span>
                    <select
                      value={rule.category}
                      onChange={(e) => updateRule(setCategoryRules, rule.id, { category: e.target.value })}
                      className="border rounded px-2 py-1"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-gray-600">
                      <input
                        type="checkbox"
                        checked={rule.override}
                        onChange={(e) => updateRule(setCategoryRules, rule.id, { override: e.target.checked })}
                      />
                      凌駕倉庫對應
                    </label>
                    <button
                      onClick={() => removeRule(setCategoryRules, rule.id)}
                      className="text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 貨號 → 品牌 對應（品牌別版本用） */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-gray-800">貨號對應品牌</h4>
                <button
                  onClick={() => setBrandRules(prev => [...prev, newRule({ brand: '' })])}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm border border-blue-200 rounded px-2 py-1"
                >
                  <Plus className="h-3 w-3 mr-1" />新增
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                依貨號開頭標記品牌，供「品牌別」版本的品牌欄篩選；沒設定則品牌欄留白。命中多筆取最長前綴。
              </p>
              {brandRules.length === 0 && <p className="text-xs text-gray-400">尚無規則</p>}
              <div className="space-y-2">
                {brandRules.map(rule => (
                  <div key={rule.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-gray-500">貨號開頭</span>
                    <input
                      type="text"
                      value={rule.prefix}
                      onChange={(e) => updateRule(setBrandRules, rule.id, { prefix: e.target.value })}
                      placeholder="如 4、HV"
                      className="border rounded px-2 py-1 w-24 font-mono"
                    />
                    <span className="text-gray-400">→</span>
                    <input
                      type="text"
                      value={rule.brand}
                      onChange={(e) => updateRule(setBrandRules, rule.id, { brand: e.target.value })}
                      placeholder="品牌名"
                      className="border rounded px-2 py-1 w-32"
                    />
                    <button
                      onClick={() => removeRule(setBrandRules, rule.id)}
                      className="text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 提取的表格區塊顯示 */}
        {extractedTables.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">提取的表格區塊</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {extractedTables.map((table, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-800 mb-1">{warehouseMapping[table.name] || table.sourceType}</div>
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

            {/* 庫存匯總預覽（欄位與匯出共用 columns / cellValue） */}
            <div className="bg-white border rounded-lg overflow-hidden mb-4">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h4 className="font-medium">庫存匯總預覽 (前10項)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map(col => (
                        <th key={col.key} className="px-2 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                          {col.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.summary.slice(0, 10).map((item, index) => (
                      <tr key={index}>
                        {columns.map(col => (
                          <td key={col.key} className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {cellValue(item, col.key)}
                          </td>
                        ))}
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
    </div>
  );
};

export default ExcelMergeTool;
