# A. Harness 快速診斷（2026-07-03 建立，2026-07-04 由 Fable 5 二次驗證補強）

本檔是後面所有制度檔的依據。前三名問題按「燒 token × 出錯頻率」排序。

## 第 1 名：主對話直接吞大檔／大工具結果（最漏 token）

**症狀 a（Read/Grep）**：主對話用 Read 讀整個 500+ 行的檔案、用 Grep 撈幾十筆結果全文進 context，只為了找一小段。實例：曾把 638 行的元件全檔讀進主對話，實際只需要其中約 60 行。context 一膨脹，弱模型注意力被稀釋，後半段開始漏規則、忘記早前決定。

**症狀 b（MCP 工具，實測最嚴重）**：MCP 工具的回傳無法裁剪，一次 fetch 就灌爆。實例（2026-07-04 實測）：`notion-fetch` 一張含圖片的頁面回傳 3 萬+ 字元，其中 90% 是 S3 簽名 URL 垃圾；一輪並行 fetch 15 頁直接吃掉約 1/3 context。同理適用其他會回大 payload 的 MCP 工具（瀏覽器 read_page、network requests 等）。

**修法（可直接執行的判準）**：
- Read 之前先估行數：`Glob` 找到檔案後，若不確定大小，先 `Grep` 目標關鍵字拿行號，再用 `Read` 的 `offset`/`limit` 只讀該區段 ±30 行。
- 需要掃 3 個以上檔案、或「找出所有 X 在哪裡」型的任務 → 派 `Explore` subagent，主對話只收結論與 `檔案:行號`。
- Grep 用 `head_limit`（預設就好）且優先 `files_with_matches`，確認目標檔後才用 `content` 模式加 `-C`。
- **MCP 大 payload 隔離**：預期回傳大的 MCP 呼叫（Notion 整頁 fetch、瀏覽器整頁讀取、一次抓 3 個以上外部資源）→ 派 `general-purpose` subagent 去呼叫，prompt 要求「只回我需要的欄位／摘要，長內容落檔回傳路徑」。主對話只有在「單次、小頁、馬上要用」時才自己呼叫 MCP。判準：估不出回傳大小＝當它是大的。

## 第 2 名：憑印象陳述環境事實（最容易出錯）

**症狀**：不查證就寫出工具參數、模型名、路徑、shell 語法。弱模型此問題更嚴重。本環境的具體地雷：
- PowerShell 5.1 沒有 `&&`／`||`；Bash 工具是 Git Bash。兩個工具語法完全不同。
- Agent tool 的 model 參數只接受 `sonnet`/`opus`/`haiku`/`fable`，**沒有 effort 參數**。
- 專案限定的事實（port、task 名、路徑）以各專案 CLAUDE.md 為準；本檔只留跨專案通則。
- 本專案（tools-dashboard）：CRA，沒有獨立 lint／typecheck script，驗證用 `npm run build`（含 eslint）與 `CI=true npm test`。

**修法**：
- 任何「這個工具/API/設定支援 X 嗎」的陳述，先查（讀 schema、讀 CLAUDE.md、跑 `--help`），查不到就寫「未驗證」。
- 涉及 Claude/Anthropic API 的問題一律先用 `claude-api` skill，不憑記憶答。
- 給使用者的路徑、指令，發出前自己先跑一次確認存在（PowerShell 工具用 `Test-Path`；Bash 工具用 `[ -e "路徑" ]`——別在 Bash 裡跑 Test-Path）。

## 第 3 名：自驗自證 + 無證據宣稱完成（最容易失焦成重試循環）

**症狀**：改完程式自己宣稱「完成」「應該可以了」，沒跑測試；或跑了失敗就原地小改重試，燒掉多輪 token 仍在同一個坑裡。弱模型特別容易在錯誤的假設上連續重試。

**修法**：
- 宣稱完成前必附證據：測試輸出、typecheck 結果、read-back 的檔案內容。沒證據就寫「已改、未驗證」。
- 同一個錯誤修兩次仍失敗 → 停止重試，改走 [judgment.md](judgment.md) 的換路/升級判準。
- 重要交付的驗收派 fresh-context subagent（見 [dispatch.md](dispatch.md) 的「驗證不自驗」）。

## 次要問題（不進前三，但值得知道）

- 全域 `settings.json` 的 permissions allowlist 容易累積大量一次性指令，是噪音但無害；可用 `fewer-permission-prompts` skill 整理。
- superpowers plugin（2026-07-13 觀察）在 session 開頭注入大量 skill 與「必須先 invoke skill」的強制語氣。skills 本身有用（systematic-debugging、verification-before-completion 與本制度精神一致），但與 CLAUDE.md/ops 衝突時以後者為準（CLAUDE.md 核心規則 6、judgment.md §6）。
- 部分工具是 deferred（WebFetch/WebSearch/SendMessage 等），要先 ToolSearch 批次載入 schema 才能呼叫（詳見 dispatch.md §0）。

## 變更記錄
- 2026-07-04 Fable 5 補「MCP 大 payload」症狀與修法、標註 LHC 限定事實。
- 2026-07-13 Fable 5 次要問題補 superpowers 強制語氣、deferred tools。
