# Tools Dashboard

內部工具平台，提供 Excel 資料處理、出貨統計等自動化工具。

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

詳細開發說明請見 [docs/dev/](docs/dev/)：

- [架構說明](docs/dev/architecture.md)
- [新增工具頁面](docs/dev/add-new-page.md)
- [部署流程](docs/dev/deployment.md)

與 Claude Code 協作的開發指南（派工、驗證、判斷準則）見 [docs/ops/](docs/ops/)。
