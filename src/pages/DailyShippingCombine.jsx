import React, { useState } from "react";
import { Upload, Download, FileSpreadsheet, ArrowLeft, Trash2, Eye, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const DailyShippingCombine = () => {
  const navigate = useNavigate();
  
  // 每個來源以訂單為單位儲存
  const [ordersBySource, setOrdersBySource] = useState({
    宅配: {},  // { orderName: { header, rows } }
    "7-11": {},
    全家: {},
  });
  const [unclassifiedOrders, setUnclassifiedOrders] = useState({}); // 真正無法分類的訂單
  const [uploadedFiles, setUploadedFiles] = useState([]); // {name, rows}
  const [summaryData, setSummaryData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBackToHome = () => {
    navigate("/");
  };

  // 清除所有資料
  const handleClearAll = () => {
    if (window.confirm("確定要清除所有資料嗎？")) {
      setOrdersBySource({
        宅配: {},
        "7-11": {},
        全家: {},
      });
      setUnclassifiedOrders({});
      setUploadedFiles([]);
      setSummaryData([]);
    }
  };

  // 上傳並解析多個檔案
  const handleFilesUpload = (event) => {
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

            // Step 1: 按 Name（訂單編號）分組
            const orderGroups = {};
            rows.forEach((row) => {
              const orderName = row["Name"];
              if (!orderName) return; // 跳過沒有訂單編號的列
              
              if (!orderGroups[orderName]) {
                orderGroups[orderName] = [];
              }
              orderGroups[orderName].push(row);
            });

            // Step 2: 根據母單的 Tags 分類整個訂單
            setOrdersBySource((prev) => {
              const newState = { ...prev };
              const newUnclassified = { ...unclassifiedOrders };

              Object.entries(orderGroups).forEach(([orderName, orderRows]) => {
                // 找出母單（有 Payment ID 的記錄）
                const motherRow = orderRows.find(r => r["Payment ID"]);
                
                if (motherRow) {
                  // 根據母單的 Tags 決定分類
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
                    // // 將整個訂單（母單+子單）加入對應分類
                    // if (!newState[sourceType][orderName]) {
                    //   newState[sourceType][orderName] = {
                    //     header: header,
                    //     rows: orderRows,
                    //     filename: file.name
                    //   };
                    // } else {
                    //   // 如果訂單已存在，合併資料
                    //   newState[sourceType][orderName].rows.push(...orderRows);
                    // }
                    if (!newState[sourceType][orderName]) {
                      // 第一次出現，直接存整個訂單
                      newState[sourceType][orderName] = {
                        header: header,
                        rows: orderRows,
                        filename: file.name
                      };
                    } else {
                      // 已經存在 → 合併但避免重複
                      const existingRows = newState[sourceType][orderName].rows;
                      
                      orderRows.forEach((row) => {
                        const isDuplicate = existingRows.some(
                          (r) => r["Name"] === row["Name"] && r["Lineitem name"] === row["Lineitem name"]
                        );
                        if (!isDuplicate) {
                          existingRows.push(row);
                        }
                      });
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
                  // 沒有母單的訂單（不應該發生，但以防萬一）
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

            // 更新已上傳檔案清單
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

    // 清空 input
    event.target.value = null;
  };

  // 計算匯總（只計算母單）
  const computeSummaryFromOrders = () => {
    const summary = {};
    
    const inc = (date, col) => {
      if (!summary[date]) {
        summary[date] = { 
          日期: date, 
          宅配: 0, 
          "7-11": 0, 
          全家: 0, 
          總和: 0 
        };
      }
      summary[date][col] += 1;
      summary[date]["總和"] += 1;
    };

    // 計算各來源的母單數量
    Object.entries(ordersBySource).forEach(([sourceKey, orders]) => {
      Object.values(orders).forEach((orderData) => {
        // 只計算母單（有 Payment ID 的第一筆）
        const motherRow = orderData.rows.find(r => r["Payment ID"]);
        if (motherRow) {
          const paidAt = (motherRow["Paid at"] || "").toString();
          const date = paidAt ? paidAt.split(" ")[0] : "未知日期";
          inc(date, sourceKey);
        }
      });
    });

    return Object.values(summary).sort((a, b) => a.日期.localeCompare(b.日期));
  };

  // 預覽匯總
  const handleGeneratePreview = () => {
    const summary = computeSummaryFromOrders();
    setSummaryData(summary);
  };

  // 匯出 Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 為每個來源建立分頁
      Object.entries(ordersBySource).forEach(([sourceKey, orders]) => {
        if (Object.keys(orders).length === 0) return;

        // 使用第一個訂單的 header
        const firstOrder = Object.values(orders)[0];
        const header = firstOrder.header;
        const aoa = [header];

        // 按訂單名稱排序
        const sortedOrderNames = Object.keys(orders).sort((a, b) => {
          const aOrder = orders[a];
          const bOrder = orders[b];
          const aMotherRow = aOrder.rows.find(r => r["Payment ID"]);
          const bMotherRow = bOrder.rows.find(r => r["Payment ID"]);
          const aDate = aMotherRow ? aMotherRow["Paid at"] || "" : "";
          const bDate = bMotherRow ? bMotherRow["Paid at"] || "" : "";
          return aDate.localeCompare(bDate);
        });

        // 處理每個訂單，確保母單在前、子單在後
        sortedOrderNames.forEach((orderName) => {
          const orderData = orders[orderName];
          const motherRow = orderData.rows.find(r => r["Payment ID"]);
          const childRows = orderData.rows.filter(r => !r["Payment ID"]);
          
          if (motherRow) {
            // 先加入母單
            aoa.push(header.map(h => {
              const value = motherRow[h];
              return value === undefined || value === null ? "" : value;
            }));
            
            // 再加入所有子單
            childRows.forEach((childRow) => {
              aoa.push(header.map(h => {
                const value = childRow[h];
                return value === undefined || value === null ? "" : value;
              }));
            });
          } else {
            // 沒有母單的情況（不應該發生）
            orderData.rows.forEach((row) => {
              aoa.push(header.map(h => {
                const value = row[h];
                return value === undefined || value === null ? "" : value;
              }));
            });
          }
        });

        // 建立工作表
        if (aoa.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, ws, sourceKey);
        }
      });

      // 如果有未分類的訂單，也建立分頁（但通常不應該有）
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
      const summaryArray = computeSummaryFromOrders();
      if (summaryArray.length > 0) {
        const wsSummary = XLSX.utils.json_to_sheet(summaryArray);
        XLSX.utils.book_append_sheet(wb, wsSummary, "匯總");
      }

      // 下載檔案
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      const date = new Date().toISOString().split('T')[0];
      saveAs(blob, `出貨報表_${date}.xlsx`);
      
    } catch (error) {
      console.error("匯出 Excel 時發生錯誤:", error);
      alert("匯出 Excel 時發生錯誤，請檢查資料或聯絡技術支援。");
    }
  };

  // 計算各來源統計
  const getSourceStats = (sourceKey) => {
    const orders = ordersBySource[sourceKey];
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

  // 取得未分類統計
  const getUnclassifiedStats = () => {
    let totalRows = 0;
    Object.values(unclassifiedOrders).forEach((orderData) => {
      totalRows += orderData.rows.length;
    });
    return { totalRows, orderCount: Object.keys(unclassifiedOrders).length };
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
              上傳 CSV 檔案，系統會根據母單的 Tags 自動分類整個訂單（含子單）
            </p>

            {/* Upload Section */}
            <div className="flex flex-col items-center space-y-4">
              <label className="flex items-center cursor-pointer bg-blue-50 text-blue-600 px-6 py-3 rounded-lg border-2 border-blue-200 hover:bg-blue-100 transition-all hover:border-blue-300">
                <Upload className="h-5 w-5 mr-2" />
                選擇 CSV 檔案 (可多選)
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={handleFilesUpload}
                  disabled={isProcessing}
                />
              </label>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleGeneratePreview}
                  className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={Object.values(ordersBySource).every(o => Object.keys(o).length === 0)}
                >
                  <Eye className="h-5 w-5 mr-2" />
                  預覽匯總
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={Object.values(ordersBySource).every(o => Object.keys(o).length === 0)}
                >
                  <Download className="h-5 w-5 mr-2" />
                  下載 Excel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex items-center bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={uploadedFiles.length === 0}
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  清除所有
                </button>
              </div>
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="mt-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">處理中...</span>
              </div>
            )}

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-8 text-left bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <FileSpreadsheet className="h-5 w-5 mr-2 text-blue-500" />
                  已上傳的檔案
                </h3>
                <div className="space-y-2">
                  {uploadedFiles.map((f, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white px-4 py-2 rounded border border-gray-200">
                      <span className="text-sm text-gray-700">{f.name}</span>
                      <span className="text-sm font-medium text-blue-600">{f.rows} 筆</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistics */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {["宅配", "7-11", "全家"].map((key) => {
                const stats = getSourceStats(key);
                
                return (
                  <div 
                    key={key} 
                    className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-4"
                  >
                    <h4 className="font-semibold text-blue-700 mb-2">{key}</h4>
                    <div className="text-2xl font-bold text-gray-800">{stats.orderCount} 筆訂單</div>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <div>母單: {stats.motherOrders} 筆</div>
                      <div>子單: {stats.childRows} 筆</div>
                      <div>總計: {stats.totalRows} 筆資料</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unclassified Warning */}
            {Object.keys(unclassifiedOrders).length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center text-yellow-800">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span>有 {getUnclassifiedStats().orderCount} 筆訂單無法分類（母單缺少 Tags）</span>
                </div>
              </div>
            )}

            {/* Summary Preview Table */}
            {summaryData.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-800 mb-3 text-left">
                  匯總預覽（只計算母單數量）
                </h3>
                <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        <th className="border-b border-gray-200 px-4 py-3 text-left font-medium text-gray-700">日期</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">宅配</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">7-11</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-gray-700">全家</th>
                        <th className="border-b border-gray-200 px-4 py-3 text-center font-medium text-blue-700">總和</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {summaryData.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="border-b border-gray-100 px-4 py-3">{r.日期}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r.宅配 || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r["7-11"] || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center">{r.全家 || 0}</td>
                          <td className="border-b border-gray-100 px-4 py-3 text-center font-semibold text-blue-600">
                            {r.總和}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 bg-blue-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">處理邏輯說明</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ <strong>正確分類</strong>：子單會跟隨母單的 Tags 分類到同一分頁</li>
                <li>✅ <strong>母單子單排序</strong>：同訂單的母單在前，子單在後</li>
                <li>✅ <strong>匯總計算</strong>：只計算母單（有 Payment ID）的數量</li>
                <li>✅ <strong>不會有未分類的子單</strong>：所有子單都會跟隨母單分類</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyShippingCombine;