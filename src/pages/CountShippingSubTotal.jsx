import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Download, FileSpreadsheet, ArrowLeft, Trash2, Eye, DollarSign, TrendingUp, FileUp, Plus } from "lucide-react";
import * as XLSX from "xlsx";
import { parseCSVFile, groupOrdersByName, classifyOrderSource } from "../utils/orderUtils";

const CountShippingSubTotal = () => {
  const navigate = useNavigate();

  // 儲存現有報表的資料
  const [existingReport, setExistingReport] = useState(null);
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
  const [lastMergeResult, setLastMergeResult] = useState(null);

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
      setLastMergeResult(null);
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
              rows: jsonData.slice(1)
            };
          }
        });
        
        setExistingReport(reportData);
        setHasExistingReport(true);
        setLastMergeResult(null);
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
  const handleNewDataUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setLastMergeResult(null);
    setIsProcessing(true);
    let processedCount = 0;

    for (const file of files) {
      try {
        const { result } = await parseCSVFile(file);
        const header = result.meta.fields || [];
        const rows = result.data || [];

        const orderGroups = groupOrdersByName(rows);

        setNewOrdersBySource((prev) => {
          const newState = {
            宅配: { ...prev.宅配 },
            "7-11": { ...prev["7-11"] },
            全家: { ...prev.全家 },
          };
          Object.entries(orderGroups).forEach(([orderName, orderRows]) => {
            const motherRow = orderRows.find((r) => r["Payment ID"]);
            if (motherRow) {
              const sourceType = classifyOrderSource(motherRow);
              if (sourceType && !newState[sourceType][orderName]) {
                newState[sourceType][orderName] = {
                  header,
                  rows: orderRows,
                  filename: file.name,
                };
              }
            }
          });
          return newState;
        });

        setUnclassifiedOrders((prev) => {
          const newUnclassified = { ...prev };
          Object.entries(orderGroups).forEach(([orderName, orderRows]) => {
            const motherRow = orderRows.find((r) => r["Payment ID"]);
            const isClassified = classifyOrderSource(motherRow) !== null;
            if (!isClassified && !newUnclassified[orderName]) {
              newUnclassified[orderName] = {
                header,
                rows: orderRows,
                filename: file.name,
              };
            }
          });
          return newUnclassified;
        });

        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, rows: rows.length },
        ]);

        processedCount++;
      } catch (error) {
        console.error(`解析檔案 ${file.name} 時發生錯誤:`, error);
        processedCount++;
      }
    }

    setIsProcessing(false);
    event.target.value = null;
  };

  // 合併資料並計算匯總
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
          if (existingPaymentIds.has(motherRow["Payment ID"])) {
            skippedOrderCount++;
          } else {
            filteredOrderNames.push(orderName);
          }
        } else {
          filteredOrderNames.push(orderName);
        }
      });
      
      // 按日期排序
      const sortedOrderNames = filteredOrderNames.sort((a, b) => {
        const aOrder = orders[a];
        const bOrder = orders[b];
        const aMotherRow = aOrder.rows.find(r => r["Payment ID"]);
        const bMotherRow = bOrder.rows.find(r => r["Payment ID"]);
        const aDate = aMotherRow ? aMotherRow["Paid at"] || "" : "";
        const bDate = bMotherRow ? bMotherRow["Paid at"] || "" : "";
        return bDate.localeCompare(aDate);
      });

      // 加入新資料
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

    // 加入現有報表資料
    if (hasExistingReport && existingReport) {
      ["宅配", "7-11", "全家"].forEach(sourceKey => {
        if (existingReport[sourceKey]) {
          const existingData = existingReport[sourceKey];
          
          if (!mergedData[sourceKey].header && existingData.header) {
            mergedData[sourceKey].header = existingData.header;
          }
          
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

    // 計算匯總（確保子單跟隨母單日期）
    const summaryMap = {};
    
    Object.entries(mergedData).forEach(([sourceKey, data]) => {
      let currentMotherDate = null; // 記錄當前母單的日期
      let currentIsRefund = false; // 追蹤當前母單是否為退貨
      
      data.rows.forEach(row => {
        // 如果是母單，更新當前日期
        if (row["Payment ID"]) {
          const paidAt = (row["Paid at"] || "").toString();
          currentMotherDate = paidAt ? paidAt.split(" ")[0] : null;

          // 檢查退貨狀態
          const financialStatus = (row["Financial Status"] || "").toString().toLowerCase();
          currentIsRefund = financialStatus === "refunded" || financialStatus === "partially_refunded";
        }
        
        // 使用母單日期（子單跟隨母單）
        const date = currentMotherDate || "未知日期";
        
        if (!summaryMap[date]) {
          summaryMap[date] = {
            日期: date,
            總業績: 0,
            總訂單數: 0,
            總雙數: 0,
            退貨訂單數: 0,
            退貨總雙數: 0,
            退貨業績: 0,
            宅配有運費: 0,
            宅配無運費: 0,
            宅配總雙數: 0,
            宅配業績: 0,
            宅配平均金額: 0,
            "7-11有運費": 0,
            "7-11無運費": 0,
            "7-11總雙數": 0,
            "7-11業績": 0,
            "7-11平均金額": 0,
            全家有運費: 0,
            全家無運費: 0,
            全家總雙數: 0,
            全家業績: 0,
            全家平均金額: 0
          };
        }
        
        // 計算母單資料
        if (row["Payment ID"]) {
          const subtotalStr = (row["Subtotal"] || "0").toString().replace(/,/g, '');
          const subtotal = parseFloat(subtotalStr) || 0;
          const shippingStr = (row["Shipping"] || "0").toString().replace(/,/g, '');
          const shipping = parseFloat(shippingStr) || 0;
          
          summaryMap[date].總業績 += subtotal;
          summaryMap[date].總訂單數 += 1;
          summaryMap[date][`${sourceKey}業績`] += subtotal;
          
          if (currentIsRefund) {
            summaryMap[date].退貨業績 += subtotal;
            summaryMap[date].退貨訂單數 += 1;
          } else {
            if (shipping > 0) {
              summaryMap[date][`${sourceKey}有運費`] += 1;
            } else {
              summaryMap[date][`${sourceKey}無運費`] += 1;
            }
          }
        }
        
        // 計算總雙數（所有行，包含子單）
        const lineitemPriceStr = (row["Lineitem price"] || "0").toString().replace(/,/g, '');
        const lineitemPrice = parseFloat(lineitemPriceStr) || 0;
        
        if (lineitemPrice > 0) {
          const lineitemQtyStr = (row["Lineitem quantity"] || "0").toString();
          const lineitemQty = parseInt(lineitemQtyStr) || 0;
          summaryMap[date][`${sourceKey}總雙數`] += lineitemQty;
          summaryMap[date].總雙數 += lineitemQty;
          
          if (currentIsRefund) {
            summaryMap[date].退貨總雙數 += lineitemQty;
          } else {
            // summaryMap[date].淨雙數 += lineitemQty;
          }
        }
      });
    });

    // 計算平均金額（保留小數點後兩位）
    Object.values(summaryMap).forEach(row => {
      ["宅配", "7-11", "全家"].forEach(source => {
        const totalPairs = row[`${source}總雙數`];
        const revenue = row[`${source}業績`];
        row[`${source}平均金額`] = totalPairs > 0 ? parseFloat((revenue / totalPairs).toFixed(2)) : 0;
      });
    });

    // 按日期排序
    const summaryArray = Object.values(summaryMap).sort((a, b) => 
      b.日期.localeCompare(a.日期)
    );

    return { mergedData, summaryArray };
  };

  const computeMerge = () => {
    const result = mergeDataAndComputeSummary();
    setLastMergeResult(result);
    return result;
  };

  // 預覽匯總
  const handleGeneratePreview = () => {
    const { summaryArray } = computeMerge();
    setSummaryData(summaryArray);
  };

  // 匯出 Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const { mergedData, summaryArray } = lastMergeResult ?? mergeDataAndComputeSummary();

      // 為每個來源建立分頁（原始資料）
      ["宅配", "7-11", "全家"].forEach(sourceKey => {
        const sourceData = mergedData[sourceKey];
        if (!sourceData.header || sourceData.rows.length === 0) return;

        const aoa = [sourceData.header];
        
        sourceData.rows.forEach(row => {
          const rowArray = sourceData.header.map(col => {
            const value = row[col];
            return value === undefined || value === null ? "" : value;
          });
          aoa.push(rowArray);
        });

        if (aoa.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          
          const colWidths = sourceData.header.map(col => {
            if (col === "Paid at" || col === "Created at" || col === "Fulfilled at") {
              return { wch: 20 };
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

      // 未分類分頁
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

      // 建立統計分頁
      if (summaryArray.length > 0) {
        // 重新排列欄位順序：日期、總業績、總訂單數、總雙數、然後是各來源資料
        const summaryForExport = summaryArray.map(item => ({
          日期: item.日期,
          總業績: item.總業績,
          總訂單數: item.總訂單數,
          總雙數: item.總雙數,
          退貨訂單數: item.退貨訂單數,
          退貨總雙數: item.退貨總雙數,
          退貨業績: item.退貨業績,
          宅配有運費: item.宅配有運費,
          宅配無運費: item.宅配無運費,
          宅配總雙數: item.宅配總雙數,
          宅配業績: item.宅配業績,
          宅配平均金額: item.宅配平均金額,
          "7-11有運費": item["7-11有運費"],
          "7-11無運費": item["7-11無運費"],
          "7-11總雙數": item["7-11總雙數"],
          "7-11業績": item["7-11業績"],
          "7-11平均金額": item["7-11平均金額"],
          全家有運費: item.全家有運費,
          全家無運費: item.全家無運費,
          全家總雙數: item.全家總雙數,
          全家業績: item.全家業績,
          全家平均金額: item.全家平均金額
        }));
        
        const wsSummary = XLSX.utils.json_to_sheet(summaryForExport);
        
        // 取得欄位數量
        const colCount = Object.keys(summaryArray[0]).length;
        // 全部欄位都設成寬度 12
        wsSummary['!cols'] = Array(colCount).fill({ wch: 12 });
        
        XLSX.utils.book_append_sheet(wb, wsSummary, "統計");
      }

      // 下載檔案
      const date = new Date().toISOString().split('T')[0];
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `業績統計報表_${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
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

    Object.values(orders).forEach((orderData) => {
      orderData.rows.forEach((row) => {
        totalRows++;
        if (row["Payment ID"]) {
          motherOrders++;
        }
      });
    });

    return { totalRows, motherOrders, orderCount: Object.keys(orders).length };
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
              每日業績統計工具
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <DollarSign className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">每日業績統計工具</h2>
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
                預覽統計
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
                    
                    <div className="text-lg font-bold text-gray-800">
                      新增: {stats.orderCount} 筆訂單
                    </div>
                    <div className="text-xs text-gray-600">
                      母單: {stats.motherOrders}
                    </div>
                    
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
                <h3 className="font-semibold text-gray-800 mb-3 text-left flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  合併後統計預覽（重新計算）
                </h3>
                <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                      <tr>
                        <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700" rowSpan="2">日期</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-right font-medium text-gray-700" rowSpan="2">總業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" rowSpan="2">總訂單</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" rowSpan="2">總雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" colSpan="3">退貨</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" colSpan="3">宅配</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" colSpan="3">7-11</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-700" colSpan="3">全家</th>
                      </tr>
                      <tr>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">金額</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">均價</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">均價</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">均價</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs text-gray-600">均價</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {summaryData.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="border-b border-gray-100 px-2 py-2">{r.日期}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-right font-semibold text-green-600">
                            ${Math.round(r.總業績).toLocaleString()}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center font-semibold">
                            {r.總訂單數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center font-semibold">
                            {r.總雙數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">{r.退貨總雙數}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${Math.round(r.退貨業績).toLocaleString()}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${r.退貨總雙數 > 0 ? (r.退貨業績 / r.退貨總雙數).toFixed(2) : '0.00'}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">{r.宅配總雙數}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${Math.round(r.宅配業績).toLocaleString()}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${r.宅配平均金額}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">{r["7-11總雙數"]}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${Math.round(r["7-11業績"]).toLocaleString()}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${r["7-11平均金額"]}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">{r.全家總雙數}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${Math.round(r.全家業績).toLocaleString()}</td>
                          <td className="border-b border-gray-100 px-2 py-2 text-center">${r.全家平均金額}</td>
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
            <div className="mt-8 bg-green-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-green-900 mb-2">統計說明</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>📊 <strong>總業績</strong>：三來源 Subtotal 總和</li>
                <li>📦 <strong>總訂單數</strong>：所有母單（有 Payment ID）數量</li>
                <li>👟 <strong>總雙數</strong>：所有來源 Lineitem price {'>'} 0 的 Lineitem quantity 總和</li>
                <li>💰 <strong>平均金額</strong>：來源業績 / 來源總雙數（保留小數點後兩位）</li>
                <li>🚚 <strong>有/無運費</strong>：按 Shipping 欄位判斷（只計算母單）</li>
                <li>📁 <strong>檔案結構</strong>：包含宅配/7-11/全家原始資料分頁 + 統計分頁</li>
                <li>🔄 <strong>去重邏輯</strong>：新資料中 Payment ID 重複的訂單會自動跳過</li>
                <li>👶 <strong>子單跟隨母單</strong>：子單使用母單的日期進行統計，避免出現未知日期</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountShippingSubTotal;