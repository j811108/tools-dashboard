import React, { useState } from "react";
import { Upload, Download, FileSpreadsheet, ArrowLeft, Trash2, Eye, AlertCircle, FileUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const DailyShippingCombine = () => {
  const navigate = useNavigate();
  
  // 儲存現有報表的資料
  const [existingReport, setExistingReport] = useState(null); // { 宅配: [], 7-11: [], 全家: [], 匯總: [] }
  const [hasExistingReport, setHasExistingReport] = useState(false);
  
  // 新上傳的訂單資料
  const [newOrdersBySource, setNewOrdersBySource] = useState({
    宅配: {},
    "7-11": {},
    全家: {},
  });
  const [unclassifiedOrders, setUnclassifiedOrders] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBackToHome = () => {
    navigate("/");
  };

  // 清除所有資料
  const handleClearAll = () => {
    if (window.confirm("確定要清除所有資料嗎？")) {
      setExistingReport(null);
      setHasExistingReport(false);
      setNewOrdersBySource({
        宅配: {},
        "7-11": {},
        全家: {},
      });
      setUnclassifiedOrders({});
      setUploadedFiles([]);
      setSummaryData([]);
    }
  };

  // 上傳現有的統計報表 (Excel)
  const handleExistingReportUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const reportData = {};
        
        // 讀取每個分頁的資料
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: "" 
          });
          
          if (jsonData.length > 0) {
            reportData[sheetName] = {
              header: jsonData[0],
              rows: jsonData.slice(1) // 排除標題列
            };
          }
        });
        
        setExistingReport(reportData);
        setHasExistingReport(true);
        setIsProcessing(false);
        
        alert(`成功載入現有報表！\n包含分頁: ${Object.keys(reportData).join(', ')}`);
      } catch (error) {
        console.error("讀取 Excel 檔案錯誤:", error);
        alert("讀取 Excel 檔案失敗，請確認檔案格式正確");
        setIsProcessing(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  // 上傳新的 CSV 資料
  const handleNewDataUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    setIsProcessing(true);
    let processedCount = 0;
    
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const csvText = reader.result;
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: false,
          dynamicTyping: false,
          complete: (result) => {
            const header = result.meta.fields || [];
            const rows = result.data || [];

            // 按 Name 分組
            const orderGroups = {};
            rows.forEach((row) => {
              const orderName = row["Name"];
              if (!orderName) return;
              
              if (!orderGroups[orderName]) {
                orderGroups[orderName] = [];
              }
              orderGroups[orderName].push(row);
            });

            // 根據母單的 Tags 分類整個訂單
            setNewOrdersBySource((prev) => {
              const newState = { ...prev };
              const newUnclassified = { ...unclassifiedOrders };

              Object.entries(orderGroups).forEach(([orderName, orderRows]) => {
                // 找出母單
                const motherRow = orderRows.find(r => r["Payment ID"]);
                
                if (motherRow) {
                  const rawTag = (motherRow["Tags"] || "").toString();
                  let sourceType = null;
                  
                  if (rawTag.includes("宅配")) {
                    sourceType = "宅配";
                  } else if (rawTag.includes("全家")) {
                    sourceType = "全家";
                  } else if (rawTag.includes("7-11") || rawTag.includes("711")) {
                    sourceType = "7-11";
                  }
                  
                  if (sourceType) {
                    if (!newState[sourceType][orderName]) {
                      newState[sourceType][orderName] = {
                        header: header,
                        rows: orderRows,
                        filename: file.name
                      };
                    } else {
                      // 如果訂單已存在，合併資料，測試會導致子單重複新增
                      // newState[sourceType][orderName].rows.push(...orderRows);
                    }
                  } else {
                    // 母單沒有有效的 Tags，放到未分類
                    newUnclassified[orderName] = {
                      header: header,
                      rows: orderRows,
                      filename: file.name
                    };
                  }
                } else {
                  // 沒有母單的訂單
                  newUnclassified[orderName] = {
                    header: header,
                    rows: orderRows,
                    filename: file.name
                  };
                }
              });

              setUnclassifiedOrders(newUnclassified);
              return newState;
            });

            setUploadedFiles((prev) => [
              ...prev,
              { name: file.name, rows: rows.length },
            ]);
            
            processedCount++;
            if (processedCount === files.length) {
              setIsProcessing(false);
            }
          },
          error: (error) => {
            console.error(`解析檔案 ${file.name} 時發生錯誤:`, error);
            processedCount++;
            if (processedCount === files.length) {
              setIsProcessing(false);
            }
          }
        });
      };
      reader.readAsText(file, "UTF-8");
    });

    event.target.value = null;
  };

  // 合併資料並計算匯總（簡化版：直接合併，不去重複）
  const mergeDataAndComputeSummary = () => {
    const mergedData = {
      宅配: { header: null, rows: [] },
      "7-11": { header: null, rows: [] },
      全家: { header: null, rows: [] }
    };

    // 收集現有報表中的所有 Payment ID
    const existingPaymentIds = new Set();
    
    if (hasExistingReport && existingReport) {
      ["宅配", "7-11", "全家"].forEach(sourceKey => {
        if (existingReport[sourceKey]) {
          const existingData = existingReport[sourceKey];
          const paymentIdIndex = existingData.header.indexOf("Payment ID");
          
          if (paymentIdIndex !== -1) {
            existingData.rows.forEach(rowArray => {
              const paymentId = rowArray[paymentIdIndex];
              if (paymentId && paymentId !== "") {
                existingPaymentIds.add(paymentId);
              }
            });
          }
        }
      });
    }

    console.log(`現有報表中有 ${existingPaymentIds.size} 個不重複的 Payment ID`);

    // 統計跳過的訂單數
    let skippedOrderCount = 0;

    // 處理新資料（放在前面，但排除 Payment ID 重複的）
    Object.entries(newOrdersBySource).forEach(([sourceKey, orders]) => {
      if (Object.keys(orders).length === 0) return;
      
      const firstOrder = Object.values(orders)[0];
      mergedData[sourceKey].header = firstOrder.header;
      
      // 過濾掉 Payment ID 已存在的訂單
      const filteredOrderNames = [];
      
      Object.keys(orders).forEach(orderName => {
        const orderData = orders[orderName];
        const motherRow = orderData.rows.find(r => r["Payment ID"]);
        
        if (motherRow && motherRow["Payment ID"]) {
          // 檢查 Payment ID 是否已存在
          if (existingPaymentIds.has(motherRow["Payment ID"])) {
            skippedOrderCount++;
            console.log(`跳過訂單 ${orderName}，Payment ID ${motherRow["Payment ID"]} 已存在`);
          } else {
            filteredOrderNames.push(orderName);
          }
        } else {
          // 沒有母單或沒有 Payment ID 的訂單，保留
          filteredOrderNames.push(orderName);
        }
      });
      
      // 按日期排序（只處理未重複的訂單）
      const sortedOrderNames = filteredOrderNames.sort((a, b) => {
        const aOrder = orders[a];
        const bOrder = orders[b];
        const aMotherRow = aOrder.rows.find(r => r["Payment ID"]);
        const bMotherRow = bOrder.rows.find(r => r["Payment ID"]);
        const aDate = aMotherRow ? aMotherRow["Paid at"] || "" : "";
        const bDate = bMotherRow ? bMotherRow["Paid at"] || "" : "";
        // 新資料內部按日期降序（最新的在最前）
        return bDate.localeCompare(aDate);
      });

      // 加入新資料（母單在前，子單在後）
      sortedOrderNames.forEach((orderName) => {
        const orderData = orders[orderName];
        const motherRow = orderData.rows.find(r => r["Payment ID"]);
        const childRows = orderData.rows.filter(r => !r["Payment ID"]);
        
        if (motherRow) {
          mergedData[sourceKey].rows.push(motherRow);
          childRows.forEach(child => {
            mergedData[sourceKey].rows.push(child);
          });
        } else {
          orderData.rows.forEach(row => {
            mergedData[sourceKey].rows.push(row);
          });
        }
      });
    });

    // 顯示跳過的訂單數
    if (skippedOrderCount > 0) {
      console.log(`總共跳過 ${skippedOrderCount} 個重複的訂單`);
    }

    // 加入現有報表資料（放在後面）
    if (hasExistingReport && existingReport) {
      ["宅配", "7-11", "全家"].forEach(sourceKey => {
        if (existingReport[sourceKey]) {
          const existingData = existingReport[sourceKey];
          
          // 如果新資料沒有 header，使用現有的
          if (!mergedData[sourceKey].header && existingData.header) {
            mergedData[sourceKey].header = existingData.header;
          }
          
          // 將現有資料轉換為物件格式並加入
          existingData.rows.forEach(rowArray => {
            const rowObj = {};
            existingData.header.forEach((col, idx) => {
              rowObj[col] = rowArray[idx] || "";
            });
            mergedData[sourceKey].rows.push(rowObj);
          });
        }
      });
    }

    // 重新計算匯總（最簡單可靠的方式）
    const summaryMap = {};
    
    Object.entries(mergedData).forEach(([sourceKey, data]) => {      
      let currentMotherDate = null; // 記錄當前母單的日期
      data.rows.forEach(row => {
        // 只計算母單
        if (row["Payment ID"]) {
          const paidAt = (row["Paid at"] || "").toString();
          currentMotherDate = paidAt ? paidAt.split(" ")[0] : "未知日期";
        }
        
        const date = currentMotherDate || "未知日期";

        if (!summaryMap[date]) {
          summaryMap[date] = {
            日期: date,
            宅配有運費: 0,
            宅配無運費: 0,
            "7-11有運費": 0,
            "7-11無運費": 0,
            全家有運費: 0,
            全家無運費: 0,
            有運費訂單數: 0,
            無運費訂單數: 0,
            總訂單數: 0
          };
        }
          
        if (row["Payment ID"]) {
          const shippingStr = (row["Shipping"] || "0").toString().replace(/,/g, '');
          const shipping = parseFloat(shippingStr) || 0;
          
          if (shipping > 0) {
            summaryMap[date][`${sourceKey}有運費`] += 1;
            summaryMap[date].有運費訂單數 += 1;
          } else {
            summaryMap[date][`${sourceKey}無運費`] += 1;
            summaryMap[date].無運費訂單數 += 1;
          }
          summaryMap[date].總訂單數 += 1;
        }
      });
    });

    // 按日期排序（降序，最新的在前）
    const summaryArray = Object.values(summaryMap).sort((a, b) => 
      b.日期.localeCompare(a.日期)
    );

    return { mergedData, summaryArray };
  };

  // 預覽匯總
  const handleGeneratePreview = () => {
    const { summaryArray } = mergeDataAndComputeSummary();
    setSummaryData(summaryArray);
  };

  // 匯出合併後的 Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const { mergedData, summaryArray } = mergeDataAndComputeSummary();

      // 為每個來源建立分頁
      ["宅配", "7-11", "全家"].forEach(sourceKey => {
        const sourceData = mergedData[sourceKey];
        if (!sourceData.header || sourceData.rows.length === 0) return;

        const aoa = [sourceData.header];
        
        // 轉換資料為陣列格式
        sourceData.rows.forEach(row => {
          const rowArray = sourceData.header.map(col => {
            const value = row[col];
            return value === undefined || value === null ? "" : value;
          });
          aoa.push(rowArray);
        });

        if (aoa.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          
          // 設定欄寬（日期欄設為15）
          const colWidths = sourceData.header.map(col => {
            if (col === "Paid at" || col === "Created at" || col === "Fulfilled at") {
              return { wch: 12 };
            } else if (col === "日期") {
              return { wch: 12 };
            } else if (col === "Lineitem name" || col === "Email") {
              return { wch: 30 };
            } else {
              return { wch: 12 };
            }
          });
          ws['!cols'] = colWidths;
          
          XLSX.utils.book_append_sheet(wb, ws, sourceKey);
        }
      });

      // 未分類分頁（如果有）
      if (Object.keys(unclassifiedOrders).length > 0) {
        const firstOrder = Object.values(unclassifiedOrders)[0];
        const header = firstOrder.header;
        const aoa = [header];

        Object.values(unclassifiedOrders).forEach((orderData) => {
          orderData.rows.forEach((row) => {
            aoa.push(header.map(h => {
              const value = row[h];
              return value === undefined || value === null ? "" : value;
            }));
          });
        });

        if (aoa.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, ws, "未分類");
        }
      }

      // 建立匯總分頁
      if (summaryArray.length > 0) {
        const wsSummary = XLSX.utils.json_to_sheet(summaryArray);
        
        // 設定匯總表的欄寬
        // wsSummary['!cols'] = [
        //   { wch: 12 },  // 日期
        //   { wch: 10 },  // 宅配
        //   { wch: 10 },  // 7-11
        //   { wch: 10 },  // 全家
        //   { wch: 10 }   // 總和
        // ];
        
        // 取得欄位數量
        const colCount = Object.keys(summaryArray[0]).length;
        // 全部欄位都設成寬度 12
        wsSummary['!cols'] = Array(colCount).fill({ wch: 12 });

        XLSX.utils.book_append_sheet(wb, wsSummary, "匯總");
      }

      // 下載檔案（統一命名格式）
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      const date = new Date().toISOString().split('T')[0];
      saveAs(blob, `出貨報表_${date}.xlsx`);
      
    } catch (error) {
      console.error("匯出 Excel 時發生錯誤:", error);
      alert("匯出 Excel 時發生錯誤，請檢查資料或聯絡技術支援。");
    }
  };

  // 計算統計資料
  const getSourceStats = (sourceKey) => {
    const orders = newOrdersBySource[sourceKey];
    let totalRows = 0;
    let motherOrders = 0;
    let childRows = 0;

    Object.values(orders).forEach((orderData) => {
      orderData.rows.forEach((row) => {
        totalRows++;
        if (row["Payment ID"]) {
          motherOrders++;
        } else {
          childRows++;
        }
      });
    });

    return { totalRows, motherOrders, childRows, orderCount: Object.keys(orders).length };
  };

  // 取得現有報表統計
  const getExistingReportStats = () => {
    if (!hasExistingReport || !existingReport) return null;
    
    const stats = {};
    ["宅配", "7-11", "全家"].forEach(source => {
      if (existingReport[source]) {
        stats[source] = existingReport[source].rows.length;
      } else {
        stats[source] = 0;
      }
    });
    return stats;
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
              每日出貨合併工具
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <FileSpreadsheet className="h-16 w-16 mx-auto text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">每日出貨合併工具</h2>
            <p className="text-gray-600 mb-6">
              可選擇上傳現有統計報表，將新資料合併進去
            </p>

            {/* Upload Sections */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* 上傳現有報表 */}
              <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                <div className="mb-4">
                  <FileUp className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  <h3 className="font-semibold text-gray-800">步驟 1：上傳現有報表（選擇性）</h3>
                  <p className="text-sm text-gray-600 mt-2">上傳每月統計報表 Excel 檔案</p>
                </div>
                
                <label className="flex items-center justify-center cursor-pointer bg-white text-gray-600 px-4 py-2 rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition-all">
                  <FileUp className="h-5 w-5 mr-2" />
                  選擇統計報表 (Excel)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleExistingReportUpload}
                    disabled={isProcessing}
                  />
                </label>
                
                {hasExistingReport && (
                  <div className="mt-3 text-sm text-green-600">
                    ✅ 已載入現有報表
                    {getExistingReportStats() && (
                      <div className="mt-1 text-xs text-gray-500">
                        宅配: {getExistingReportStats()["宅配"]} 筆 | 
                        7-11: {getExistingReportStats()["7-11"]} 筆 | 
                        全家: {getExistingReportStats()["全家"]} 筆
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 上傳新資料 */}
              <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                <div className="mb-4">
                  <Plus className="h-10 w-10 mx-auto text-blue-400 mb-2" />
                  <h3 className="font-semibold text-blue-800">步驟 2：上傳新資料</h3>
                  <p className="text-sm text-blue-600 mt-2">上傳要新增的 CSV 檔案</p>
                </div>
                
                <label className="flex items-center justify-center cursor-pointer bg-white text-blue-600 px-4 py-2 rounded-lg border-2 border-blue-300 hover:bg-blue-50 transition-all">
                  <Upload className="h-5 w-5 mr-2" />
                  選擇 CSV 檔案 (可多選)
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    className="hidden"
                    onChange={handleNewDataUpload}
                    disabled={isProcessing}
                  />
                </label>
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 text-sm text-green-600">
                    ✅ 已上傳 {uploadedFiles.length} 個檔案
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleGeneratePreview}
                className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Object.values(newOrdersBySource).every(o => Object.keys(o).length === 0)}
              >
                <Eye className="h-5 w-5 mr-2" />
                預覽匯總
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Object.values(newOrdersBySource).every(o => Object.keys(o).length === 0) && !hasExistingReport}
              >
                <Download className="h-5 w-5 mr-2" />
                下載 Excel
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploadedFiles.length === 0 && !hasExistingReport}
              >
                <Trash2 className="h-5 w-5 mr-2" />
                清除所有
              </button>
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="mt-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">處理中...</span>
              </div>
            )}

            {/* Statistics */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {["宅配", "7-11", "全家"].map((key) => {
                const stats = getSourceStats(key);
                const existingStats = getExistingReportStats();
                
                return (
                  <div 
                    key={key} 
                    className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-4"
                  >
                    <h4 className="font-semibold text-blue-700 mb-2">{key}</h4>
                    
                    {/* 新資料統計 */}
                    <div className="text-lg font-bold text-gray-800">
                      新增: {stats.orderCount} 筆訂單
                    </div>
                    <div className="text-xs text-gray-600">
                      母單: {stats.motherOrders} | 子單: {stats.childRows}
                    </div>
                    
                    {/* 現有資料統計 */}
                    {existingStats && existingStats[key] > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="text-sm text-gray-600">
                          現有: {existingStats[key]} 筆資料
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary Preview Table */}
            {summaryData.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-800 mb-3 text-left">
                  合併後匯總預覽（重新計算）
                </h3>
                <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        <th className="border-b border-gray-200 px-4 py-3 text-left font-medium text-gray-700" style={{minWidth: '120px'}}>
                          日期
                        </th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">宅配有運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">宅配無運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">7-11有運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">7-11無運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">全家有運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">全家無運費</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-blue-700">總訂單數</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {summaryData.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="border-b border-gray-100 px-4 py-3">{r.日期}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["宅配有運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["宅配無運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["7-11有運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["7-11無運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["全家有運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["全家無運費"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center font-semibold text-blue-600">
                            {r["總訂單數"] || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summaryData.length > 10 && (
                    <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
                      顯示前 10 筆，共 {summaryData.length} 筆資料
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 bg-blue-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">合併邏輯說明</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>📊 <strong>現有報表</strong>：可選擇上傳每月統計報表（Excel 格式）</li>
                <li>➕ <strong>資料合併</strong>：新資料原樣插入最前面，現有資料保留在後面</li>
                <li>📋 <strong>保持完整</strong>：所有上傳的資料不做異動，原封不動放入分頁</li>
                <li>📅 <strong>匯總計算</strong>：重新計算所有母單數量，產生最新統計</li>
                <li>📁 <strong>檔案命名</strong>：統一輸出為「出貨報表_YYYY-MM-DD.xlsx」</li>
                <li>🔄 <strong>母單子單</strong>：同訂單的母單永遠排在子單前面</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyShippingCombine;