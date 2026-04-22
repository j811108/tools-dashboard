# Project Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改寫 README、建立 docs/guides/ 操作說明與 docs/dev/ 開發文件，整理散落的 new-page.md。

**Architecture:** 純文件異動，不修改任何程式碼。README 作為入口，docs/guides/ 給業務同事，docs/dev/ 給開發者。

**Tech Stack:** Markdown, React (CRA), Tailwind CSS, GitHub Pages (gh-pages)

---

## 檔案異動清單

| 動作 | 路徑 |
|------|------|
| 改寫 | `README.md` |
| 新增 | `docs/guides/excel-merge-tool.md` |
| 新增 | `docs/guides/daily-shipping-combine.md` |
| 新增 | `docs/guides/count-shipping-subtotal.md` |
| 新增 | `docs/guides/month-shipping-count.md` |
| 新增 | `docs/dev/add-new-page.md` |
| 新增 | `docs/dev/architecture.md` |
| 新增 | `docs/dev/deployment.md` |
| 刪除 | `new-page.md` |

---

### Task 1: 改寫 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 改寫 README.md 內容**

將以下內容完整取代現有 README.md（CRA 預設內容全部移除）：

```markdown
# Tools Dashboard

内部工具平台，提供 Excel 資料處理、出貨統計等自動化工具。

**線上網址：** https://j811108.github.io/tools-dashboard

---

## 工具列表

| 工具名稱 | 說明 | 操作文件 |
|----------|------|----------|
| 庫存表 (Excel Merge Tool) | 合併多份 Excel 庫存來源至統一格式 | [docs/guides/excel-merge-tool.md](docs/guides/excel-merge-tool.md) |
| 每日出貨合併 (Daily Shipping Combine) | 合併宅配、7-11、全家出貨 CSV | [docs/guides/daily-shipping-combine.md](docs/guides/daily-shipping-combine.md) |
| 業績計算 (Count Shipping Subtotal) | 計算各通路出貨業績（含退貨） | [docs/guides/count-shipping-subtotal.md](docs/guides/count-shipping-subtotal.md) |
| 月出貨統計 (Month Shipping Count) | 統計每月各通路出貨量 | [docs/guides/month-shipping-count.md](docs/guides/month-shipping-count.md) |

---

## 快速開始（開發）

```bash
npm install
npm start        # 開發伺服器 http://localhost:3000
npm run build    # 正式打包
npm run deploy   # 部署至 GitHub Pages
```

詳細開發說明請見 [docs/dev/](docs/dev/)。
```

- [ ] **Step 2: 確認 README.md 顯示正確**

用任何 Markdown viewer 或 GitHub preview 確認格式正確，表格對齊、連結存在。

---

### Task 2: 建立 docs/guides/ 目錄與各工具操作說明

**Files:**
- Create: `docs/guides/excel-merge-tool.md`
- Create: `docs/guides/daily-shipping-combine.md`
- Create: `docs/guides/count-shipping-subtotal.md`
- Create: `docs/guides/month-shipping-count.md`

- [ ] **Step 1: 建立 docs/guides/excel-merge-tool.md**

```markdown
# 庫存表工具（Excel Merge Tool）

## 功能說明

將含有多個倉庫區塊的 Excel 庫存來源檔，合併匯出成統一格式。

## 使用步驟

1. 開啟工具：https://j811108.github.io/tools-dashboard/excel-merge-tool
2. 上傳**來源檔**（含各倉庫資料的 Excel，副檔名 `.xlsx`）
3. 上傳**模板檔**（欄位格式定義用的 Excel）
4. 系統自動辨識倉庫區塊（總倉、平台、官網）
5. 點擊**下載**取得合併後的 Excel

## 來源檔格式說明

- 各倉庫資料以區塊方式排列，區塊標題列含「展」「總倉」「電商」「平台」「官網」「倉庫」等關鍵字
- 未知倉庫類型一律歸類為**總倉**
- 支援多個區塊在同一份 Excel 中

## 輸出格式

- 單一 Excel 檔，所有倉庫資料合併至同一分頁
- 欄位依模板定義排列

## 注意事項

- 來源檔與模板檔的欄位需能對應，否則會顯示對應錯誤提示
- 支援格式：`.xlsx`
```

- [ ] **Step 2: 建立 docs/guides/daily-shipping-combine.md**

```markdown
# 每日出貨合併工具（Daily Shipping Combine）

## 功能說明

將每日從各出貨通路（宅配、7-11、全家）下載的 CSV 訂單資料合併，並累積至統一的 Excel 報表。

## 使用步驟

1. 開啟工具：https://j811108.github.io/tools-dashboard/daily-shipping-combine
2. （選用）上傳**既有報表**（前次匯出的 Excel），讓系統自動延續舊資料
3. 上傳**新的訂單 CSV**（可多檔同時上傳）
4. 系統依 Tags 欄位自動分類至宅配 / 7-11 / 全家
5. 點擊**下載**取得合併後的 Excel

## 輸入檔案格式

- 格式：CSV（逗號分隔）
- 必要欄位：`Tags`（用於判斷通路）、`Payment ID`（用於去重）、`Name`（母單號碼）
- 通路判斷邏輯：
  - Tags 含「宅配」→ 宅配分頁
  - Tags 含「全家」→ 全家分頁
  - Tags 含「7-11」或「711」→ 7-11 分頁

## 去重機制

- 以 `Payment ID` 判斷是否重複
- 子單（無獨立識別碼）以母單 + 子單整批判斷，相同批次不重複新增

## 輸出格式

- Excel，含四個分頁：`宅配`、`7-11`、`全家`、`匯總`
- 各分頁資料依日期降序排列（最新在上）

## 注意事項

- 每次上傳前建議先上傳既有報表，避免資料重複
- 若未上傳既有報表，本次上傳資料將作為全新報表
```

- [ ] **Step 3: 建立 docs/guides/count-shipping-subtotal.md**

```markdown
# 業績計算工具（Count Shipping Subtotal）

## 功能說明

讀取出貨訂單資料，依通路（宅配、7-11、全家）計算出貨業績小計，支援退貨扣除。

## 使用步驟

1. 開啟工具：https://j811108.github.io/tools-dashboard/count-shipping-subtotal
2. （選用）上傳**既有統計報表**（前次匯出的 Excel）
3. 上傳**新的訂單 CSV**（可多檔）
4. 系統依通路分類並計算業績
5. 點擊**下載**取得統計報表

## 輸入檔案格式

- 格式：CSV
- 通路分類方式同每日出貨合併工具（依 Tags 欄位）

## 業績計算說明

- 計算各通路訂單金額小計
- 退貨訂單會從業績中扣除
- 輸出含各通路分頁與彙總頁

## 輸出格式

- Excel，含通路分頁（宅配、7-11、全家）與業績彙總

## 注意事項

- 退貨資料須包含在上傳的 CSV 中，系統自動識別
```

- [ ] **Step 4: 建立 docs/guides/month-shipping-count.md**

```markdown
# 月出貨統計工具（Month Shipping Count）

## 功能說明

統計每月各通路出貨量，累積至統一的月份統計報表。

## 使用步驟

1. 開啟工具：https://j811108.github.io/tools-dashboard/month-shipping-count
2. （選用）上傳**既有月份統計報表**（前次匯出的 Excel）
3. 上傳**新的訂單 CSV**
4. 系統自動統計各月份出貨量
5. 點擊**下載**取得更新後的統計報表

## 輸入檔案格式

- 格式：CSV
- 日期欄位用於判斷月份歸屬

## 輸出格式

- Excel，含「月份統計」分頁
- 依月份排列，各通路出貨量並列顯示

## 注意事項

- 上傳既有報表可累積歷史資料，避免重新計算
```

---

### Task 3: 建立 docs/dev/ 開發文件

**Files:**
- Create: `docs/dev/add-new-page.md`
- Create: `docs/dev/architecture.md`
- Create: `docs/dev/deployment.md`

- [ ] **Step 1: 建立 docs/dev/add-new-page.md（整理自 new-page.md）**

```markdown
# 新增工具頁面指南

## 步驟

### 1. 建立頁面元件

在 `src/pages/` 新增 `YourToolName.jsx`：

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const YourToolName = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />返回工具首頁
            </button>
            <h1 className="text-xl font-semibold text-gray-900">工具名稱</h1>
            <div></div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 工具內容 */}
      </div>
    </div>
  );
};

export default YourToolName;
```

### 2. 在 App.js 新增路由

開啟 `src/App.js`，加入 import 與 Route：

```jsx
import YourToolName from './pages/YourToolName';

// 在 Routes 內新增：
<Route path="/your-tool-name" element={<YourToolName />} />
```

### 3. 在首頁新增工具卡片

開啟 `src/components/Homepage.jsx`，在 `tools` 陣列新增：

```js
{
  id: 'your-tool-name',
  name: 'Your Tool Name',
  description: '工具中文描述',
  path: '/your-tool-name',
  available: true
}
```

### 4. 新增操作說明文件

在 `docs/guides/` 新增 `your-tool-name.md`，說明輸入格式、操作步驟、輸出格式。

## 目錄結構

```
src/
├── App.js                  # 路由設定
├── components/
│   └── Homepage.jsx        # 首頁工具卡片
└── pages/
    └── YourToolName.jsx    # 工具頁面元件
```
```

- [ ] **Step 2: 建立 docs/dev/architecture.md**

```markdown
# 專案架構說明

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | React 19 (Create React App) |
| 路由 | React Router v7 |
| 樣式 | Tailwind CSS v3 |
| Excel 處理 | SheetJS (xlsx) |
| CSV 解析 | Papa Parse |
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
│   └── pages/           # 各工具頁面
│       ├── ExcelMergeTool.jsx
│       ├── DailyShippingCombine.jsx
│       ├── CountShippingSubTotal.jsx
│       ├── MonthShippingCount.jsx
│       └── Tester.jsx
├── docs/
│   ├── guides/          # 工具操作說明（給業務同事）
│   └── dev/             # 開發文件（給開發者）
└── package.json
```

## 路由設計

- basename：`/tools-dashboard`（對應 GitHub Pages 子路徑）
- 首頁：`/`
- 工具頁：`/excel-merge-tool`、`/daily-shipping-combine`、`/count-shipping-subtotal`、`/month-shipping-count`
- 404：重導向至首頁

## 資料流

所有工具均為純前端處理，無後端 API：

1. 使用者上傳檔案（Excel / CSV）
2. 瀏覽器端解析（xlsx / Papa Parse）
3. React state 管理資料
4. 使用者觸發下載（file-saver）
```

- [ ] **Step 3: 建立 docs/dev/deployment.md**

```markdown
# 部署流程

## 部署目標

GitHub Pages：https://j811108.github.io/tools-dashboard

## 部署指令

```bash
npm run deploy
```

此指令會依序執行：
1. `npm run build`：產生 `build/` 靜態檔案
2. `gh-pages -d build`：推送至 `gh-pages` 分支

## 設定說明

`package.json` 中的設定：

```json
{
  "homepage": "https://j811108.github.io/tools-dashboard",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

`src/App.js` 中 Router 的 basename 需對應 homepage 路徑：

```jsx
<Router basename="/tools-dashboard">
```

## 注意事項

- 部署前確認本地 `npm start` 正常運作
- `gh-pages` 套件需已安裝（`devDependencies` 中）
- 部署後約 1-2 分鐘生效
```

---

### Task 4: 刪除 new-page.md

**Files:**
- Delete: `new-page.md`

- [ ] **Step 1: 確認 docs/dev/add-new-page.md 已建立**

確認 Task 3 Step 1 完成後再執行此步驟。

- [ ] **Step 2: 刪除 new-page.md**

```bash
rm new-page.md
```

確認刪除後根目錄不再有 `new-page.md`。
