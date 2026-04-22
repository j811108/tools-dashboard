---
title: 專案整理與文件化設計
date: 2026-04-22
status: approved
---

# 專案整理與文件化設計

## 目標

整理 tools-dashboard 專案，讓 README 反映實際專案內容，並建立 docs 資料夾提供操作說明（給業務同事）與開發文件（給開發者）。所有修改不進行 commit，直到使用者確認。

## 受眾

- **業務同事**：需要工具操作說明、輸入格式、輸出結果
- **開發者（自己）**：需要架構說明、新增頁面流程、部署步驟

## README.md 改寫

取代 CRA 預設內容，改為：
- 專案名稱與一句話描述
- 線上連結（https://j811108.github.io/tools-dashboard）
- 工具列表（名稱 + 中文說明 + docs 連結）
- 快速開始（install / start / deploy）
- 連結到 docs/dev/ 開發文件

## docs 目錄結構

```
docs/
├── guides/                        # 業務操作說明（給使用工具的同事）
│   ├── excel-merge-tool.md        # 庫存表工具
│   ├── daily-shipping-combine.md  # 每日出貨合併工具
│   ├── count-shipping-subtotal.md # 出貨明細計算業績
│   └── month-shipping-count.md    # 每月出貨統計
└── dev/                           # 開發文件（給開發者）
    ├── add-new-page.md            # 新增頁面指南（整理自 new-page.md）
    ├── architecture.md            # 專案架構說明
    └── deployment.md              # 部署流程（gh-pages）
```

## 檔案異動

- `README.md`：完整改寫
- `new-page.md`：內容整理後移至 `docs/dev/add-new-page.md`，原檔刪除
- 新增所有 `docs/` 下的 .md 檔案

## 不在本次範圍

- 修改任何 .jsx / .js 程式碼
- 變更 UI 或功能
- 進行 git commit
