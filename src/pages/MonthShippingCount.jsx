import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Download, Calendar, ArrowLeft, Trash2, Eye, TrendingUp, FileUp, Plus } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const MonthShippingCount = () => {
  const navigate = useNavigate();
  // 儲存現有報表的資料
  const [existingReport, setExistingReport] = useState(null);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  
  // 新上傳的訂單資料
  const [newOrders, setNewOrders] = useState({});
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
      setNewOrders({});
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
        
        // 讀取統計分頁
        if (workbook.SheetNames.includes('月份統計')) {
          const worksheet = workbook.Sheets['月份統計'];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: "" 
          });
          
          if (jsonData.length > 0) {
            setExistingReport({
              header: jsonData[0],
              rows: jsonData.slice(1)
            });
            setHasExistingReport(true);
          }
        }
        
        setIsProcessing(false);
        alert(`成功載入現有報表！`);
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

            // 儲存訂單資料（不分來源）
            setNewOrders((prev) => {
              const newState = { ...prev };

              Object.entries(orderGroups).forEach(([orderName, orderRows]) => {
                if (!newState[orderName]) {
                  newState[orderName] = {
                    header: header,
                    rows: orderRows,
                    filename: file.name
                  };
                }
              });

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

  // 合併資料並計算匯總
  const mergeDataAndComputeSummary = () => {
    // 收集現有報表中的所有 Payment ID
    const existingPaymentIds = new Set();
    
    if (hasExistingReport && existingReport) {
      const paymentIdIndex = existingReport.header.indexOf("Payment ID");
      
      if (paymentIdIndex !== -1) {
        existingReport.rows.forEach(rowArray => {
          const paymentId = rowArray[paymentIdIndex];
          if (paymentId && paymentId !== "") {
            existingPaymentIds.add(paymentId);
          }
        });
      }
    }

    // 按月份統計
    const monthlyMap = {};
    
    // 處理新訂單資料
    Object.values(newOrders).forEach(orderData => {
      // Find the mother row first to check for duplicates
      const motherRow = orderData.rows.find(r => r["Payment ID"]);

      // Skip the entire order if the mother's Payment ID is already in existing report
      if (motherRow && existingPaymentIds.has(motherRow["Payment ID"])) {
        return;
      }

      let currentMotherDate = null;
      let currentIsRefund = false;

      orderData.rows.forEach(row => {
        if (row["Payment ID"]) {
          const paidAt = (row["Paid at"] || "").toString();
          currentMotherDate = paidAt ? paidAt.split(" ")[0] : null;

          const financialStatus = (row["Financial Status"] || "").toString().toLowerCase();
          currentIsRefund = financialStatus === "refunded" || financialStatus === "partially_refunded";
        }

        const date = currentMotherDate || "未知日期";
        const month = date.substring(0, 7);

        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            月份: month,
            總業績: 0,
            總訂單數: 0,
            總雙數: 0,
            淨業績: 0,
            淨訂單數: 0,
            淨雙數: 0,
            退貨訂單數: 0,
            退貨總雙數: 0,
            退貨業績: 0
          };
        }

        if (row["Payment ID"]) {
          const subtotalStr = (row["Subtotal"] || "0").toString().replace(/,/g, '');
          const subtotal = parseFloat(subtotalStr) || 0;

          monthlyMap[month].總業績 += subtotal;
          monthlyMap[month].總訂單數 += 1;

          if (currentIsRefund) {
            monthlyMap[month].退貨業績 += subtotal;
            monthlyMap[month].退貨訂單數 += 1;
          } else {
            monthlyMap[month].淨業績 += subtotal;
            monthlyMap[month].淨訂單數 += 1;
          }
        }

        const lineitemPriceStr = (row["Lineitem price"] || "0").toString().replace(/,/g, '');
        const lineitemPrice = parseFloat(lineitemPriceStr) || 0;

        if (lineitemPrice > 0) {
          const lineitemQtyStr = (row["Lineitem quantity"] || "0").toString();
          const lineitemQty = parseInt(lineitemQtyStr) || 0;
          monthlyMap[month].總雙數 += lineitemQty;
          if (currentIsRefund) {
            monthlyMap[month].退貨總雙數 += lineitemQty;
          } else {
            monthlyMap[month].淨雙數 += lineitemQty;
          }
        }
      });
    });

    // 計算 AUP, UPT, AOV
    Object.values(monthlyMap).forEach(row => {
      // AUP = 總業績 / 總雙數
      row.AUP = row.淨雙數 > 0 ? parseFloat((row.淨業績 / row.淨雙數).toFixed(2)) : 0;
      
      // UPT = 總雙數 / 總訂單數
      row.UPT = row.淨訂單數 > 0 ? parseFloat((row.淨雙數 / row.淨訂單數).toFixed(2)) : 0;
      
      // AOV = 總業績 / 總訂單數
      row.AOV = row.淨訂單數 > 0 ? parseFloat((row.淨業績 / row.淨訂單數).toFixed(2)) : 0;
    });

    // 加入現有報表資料
    if (hasExistingReport && existingReport) {
      existingReport.rows.forEach(rowArray => {
        const month = rowArray[0]; // 月份在第一欄
        if (month && !monthlyMap[month]) {
          monthlyMap[month] = {
            月份: rowArray[0],
            總業績: parseFloat(rowArray[1]) || 0,
            總訂單數: parseInt(rowArray[2]) || 0,
            總雙數: parseInt(rowArray[3]) || 0,
            淨業績: parseFloat(rowArray[4]) || 0,
            淨訂單數: parseInt(rowArray[5]) || 0,
            淨雙數: parseInt(rowArray[6]) || 0,
            退貨訂單數: parseInt(rowArray[7]) || 0,
            退貨總雙數: parseInt(rowArray[8]) || 0,
            退貨業績: parseFloat(rowArray[9]) || 0,
            AUP: parseFloat(rowArray[10]) || 0,
            UPT: parseFloat(rowArray[11]) || 0,
            AOV: parseFloat(rowArray[12]) || 0
          };
        }
      });
    }

    // 按月份排序（降序，最新的在前）
    const summaryArray = Object.values(monthlyMap).sort((a, b) => 
      b.月份.localeCompare(a.月份)
    );

    return summaryArray;
  };

  // 預覽匯總
  const handleGeneratePreview = () => {
    const summaryArray = mergeDataAndComputeSummary();
    setSummaryData(summaryArray);
  };

  // 匯出 Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const summaryArray = mergeDataAndComputeSummary();

      // 建立統計分頁
      if (summaryArray.length > 0) {
        const summaryForExport = summaryArray.map(item => ({
          月份: item.月份,
          總業績: item.總業績,
          總訂單數: item.總訂單數,
          總雙數: item.總雙數,
          淨業績: item.淨業績,
          淨訂單數: item.淨訂單數,
          淨雙數: item.淨雙數,
          退貨訂單數: item.退貨訂單數,
          退貨總雙數: item.退貨總雙數,
          退貨業績: item.退貨業績,
          AUP: item.AUP,
          UPT: item.UPT,
          AOV: item.AOV
        }));
        
        const wsSummary = XLSX.utils.json_to_sheet(summaryForExport);
        
        wsSummary['!cols'] = [
          { wch: 12 },  // 月份
          { wch: 14 },  // 總業績
          { wch: 12 },  // 總訂單數
          { wch: 12 },  // 總雙數
          { wch: 14 },  // 淨業績
          { wch: 12 },  // 淨訂單數
          { wch: 12 },  // 淨雙數
          { wch: 12 },  // 退貨訂單數
          { wch: 12 },  // 退貨總雙數
          { wch: 14 },  // 退貨業績
          { wch: 12 },  // AUP
          { wch: 12 },  // UPT
          { wch: 12 }   // AOV
        ];
        
        XLSX.utils.book_append_sheet(wb, wsSummary, "月份統計");
      }

      // 下載檔案
      const date = new Date().toISOString().split('T')[0];
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `月份業績統計_${date}.xlsx`;
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
  const getStats = () => {
    let totalOrders = 0;
    let motherOrders = 0;

    Object.values(newOrders).forEach((orderData) => {
      orderData.rows.forEach((row) => {
        totalOrders++;
        if (row["Payment ID"]) {
          motherOrders++;
        }
      });
    });

    return { totalOrders, motherOrders, orderCount: Object.keys(newOrders).length };
  };

  const stats = getStats();

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
              月份業績統計工具
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <Calendar className="h-16 w-16 mx-auto text-purple-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">月份業績統計工具</h2>
            <p className="text-gray-600 mb-6">
              按月份統計業績，計算 AUP、UPT、AOV 等關鍵指標
            </p>

            {/* Upload Sections */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* 上傳現有報表 */}
              <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                <div className="mb-4">
                  <FileUp className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  <h3 className="font-semibold text-gray-800">步驟 1：上傳現有報表（選擇性）</h3>
                  <p className="text-sm text-gray-600 mt-2">上傳月份統計報表 Excel 檔案</p>
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
                  </div>
                )}
              </div>

              {/* 上傳新資料 */}
              <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-200">
                <div className="mb-4">
                  <Plus className="h-10 w-10 mx-auto text-purple-400 mb-2" />
                  <h3 className="font-semibold text-purple-800">步驟 2：上傳新資料</h3>
                  <p className="text-sm text-purple-600 mt-2">上傳要新增的 CSV 檔案</p>
                </div>
                
                <label className="flex items-center justify-center cursor-pointer bg-white text-purple-600 px-4 py-2 rounded-lg border-2 border-purple-300 hover:bg-purple-50 transition-all">
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
                disabled={Object.keys(newOrders).length === 0}
              >
                <Eye className="h-5 w-5 mr-2" />
                預覽統計
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Object.keys(newOrders).length === 0 && !hasExistingReport}
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-3 text-gray-600">處理中...</span>
              </div>
            )}

            {/* Statistics */}
            {stats.orderCount > 0 && (
              <div className="mt-6">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-100 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-700 mb-2">新增資料統計</h4>
                  <div className="text-lg font-bold text-gray-800">
                    總共: {stats.orderCount} 筆訂單
                  </div>
                  <div className="text-xs text-gray-600">
                    母單: {stats.motherOrders}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Preview Table */}
            {summaryData.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-800 mb-3 text-left flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  月份統計預覽
                </h3>
                <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-purple-50 to-indigo-50">
                      <tr>
                        <th className="border-b border-gray-200 px-3 py-3 text-left font-medium text-gray-700" rowSpan="2">月份</th>
                        <th className="border-b border-gray-200 px-3 py-3 text-center font-medium text-green-700" colSpan="3">正常訂單</th>
                        <th className="border-b border-gray-200 px-3 py-3 text-center font-medium text-red-700" colSpan="3">退貨訂單</th>
                        <th className="border-b border-gray-200 px-3 py-3 text-center font-medium text-purple-700" colSpan="3">關鍵指標</th>
                      </tr>
                      <tr>
                        <th className="border-b border-gray-200 px-2 py-2 text-right text-xs font-medium text-gray-600">業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600">訂單</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-right text-xs font-medium text-gray-600">業績</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600">訂單</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-gray-600">雙數</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-purple-600">AUP</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-purple-600">UPT</th>
                        <th className="border-b border-gray-200 px-2 py-2 text-center text-xs font-medium text-purple-600">AOV</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {summaryData.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="border-b border-gray-100 px-3 py-3 font-medium">{r.月份}</td>
                          <td className="border-b border-gray-100 px-2 py-3 text-right font-semibold text-green-600">
                            ${Math.round(r.淨業績).toLocaleString()}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center font-semibold">
                            {r.淨訂單數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center font-semibold">
                            {r.淨雙數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-right font-semibold text-red-600">
                            ${Math.round(r.退貨業績).toLocaleString()}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center text-red-600">
                            {r.退貨訂單數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center text-red-600">
                            {r.退貨總雙數}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center text-purple-600 font-medium">
                            ${r.AUP}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center text-purple-600 font-medium">
                            {r.UPT}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-3 text-center text-purple-600 font-medium">
                            ${r.AOV}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 bg-purple-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-purple-900 mb-2">指標說明</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>📊 <strong>總業績</strong>：所有母單 Subtotal 總和</li>
                <li>📦 <strong>總訂單數</strong>：所有母單（有 Payment ID）數量</li>
                <li>👟 <strong>總雙數</strong>：所有 Lineitem price {'>'} 0 的 Lineitem quantity 總和</li>
                <li>💰 <strong>AUP (Average Unit Price)</strong>：總業績 / 總雙數</li>
                <li>📈 <strong>UPT (Units Per Transaction)</strong>：總雙數 / 總訂單數</li>
                <li>🎯 <strong>AOV (Average Order Value)</strong>：總業績 / 總訂單數</li>
                <li>📅 <strong>統計方式</strong>：按月份統計，不區分來源</li>
                <li>🔄 <strong>去重邏輯</strong>：新資料中 Payment ID 重複的訂單會自動跳過</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthShippingCount;