# 專案架構說明

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | React 19 (Create React App / react-scripts 5) |
| 路由 | React Router v7 |
| 樣式 | Tailwind CSS v3 |
| Excel 處理 | SheetJS (xlsx) |
| CSV 解析 | Papa Parse |
| 檔案下載 | file-saver（部分頁面直接用 `XLSX.writeFile` 或 Blob + a.download） |
| 圖示 | Lucide React |
| 部署 | GitHub Pages (gh-pages) |

## 目錄結構

```
tools-dashboard/
├── public/              # 靜態資源
├── src/
│   ├── App.js           # 路由設定（Router + Routes）
│   ├── components/
│   │   └── Homepage.jsx # 首頁，工具卡片列表與搜尋
│   ├── pages/           # 各工具頁面
│   │   ├── ExcelMergeTool.jsx
│   │   ├── DailyShippingCombine.jsx
│   │   ├── CountShippingSubTotal.jsx
│   │   ├── MonthShippingCount.jsx
│   │   └── Tester.jsx   # 測試用頁面（首頁卡片 available: false）
│   └── utils/
│       └── orderUtils.js # 共用邏輯：CSV 解析、訂單分組、來源分類
├── docs/
│   ├── guides/          # 工具操作說明（給業務同事）
│   ├── dev/             # 開發文件（給開發者）
│   ├── ops/             # 與 Claude Code 協作的開發指南（隨專案帶著走）
│   └── superpowers/     # 規格與實作計畫（specs / plans）
└── package.json
```

## 路由設計

- basename：`/tools-dashboard`（對應 GitHub Pages 子路徑）
- 首頁：`/`
- 工具頁：`/excel-merge-tool`、`/daily-shipping-combine`、`/count-shipping-subtotal`、`/month-shipping-count`、`/tester`
- 404：重導向至首頁

## 共用邏輯（src/utils/orderUtils.js）

| 函式 | 用途 |
|---|---|
| `parseCSVFile(file)` | 以 Papa Parse 讀 CSV（`header: true`、UTF-8），回傳 Promise |
| `groupOrdersByName(rows)` | 依 `Name`（母單號碼）把列分組 |
| `classifyOrderSource(motherRow)` | 依 `Tags` 判斷通路：宅配 / 全家 / 7-11，判不出回 `null`（歸「未分類」） |

出貨相關頁面一律共用這三個函式，不要在頁面內重寫分類邏輯。

## 資料流

所有工具均為純前端處理，無後端 API、不上傳任何資料：

1. 使用者上傳檔案（Excel / CSV）
2. 瀏覽器端解析（xlsx / Papa Parse）
3. React state 管理資料（頁面內 `useState`，無全域狀態管理）
4. 使用者觸發下載（`XLSX.writeFile` / Blob）

## 測試

CRA 內建 Jest + React Testing Library。目前僅有 `src/App.test.js`，尚無各工具頁的單元測試。
