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
