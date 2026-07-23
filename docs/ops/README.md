# 開發協作指南（與 Claude Code 共事的規則）

這裡是使用者個人的**跨專案開發指南**副本，原正本在 `%USERPROFILE%\.claude\ops\`。
放進 repo 的目的：換電腦、換 session、或別人接手時，指南跟著專案走，不必依賴本機環境。

> 這些是**協作流程**規則（怎麼派工、怎麼驗證、什麼時候該問），不是本專案的技術文件。
> 專案本身的架構、頁面、部署請看 [../dev/](../dev/)，工具操作說明看 [../guides/](../guides/)。

## 什麼時候讀哪一份

| 情境 | 讀這份 |
|---|---|
| 任務需要掃 repo、大量讀檔、批次改檔、研究 → 決定怎麼派 subagent、用哪個 model | [dispatch.md](dispatch.md) |
| 卡住了：該不該升級模型？該不該問使用者？這樣算完成嗎？方向對嗎？ | [judgment.md](judgment.md) |
| 要派工給 subagent，需要 prompt 模板（搜尋／實作／重構／研究／審查） | [templates.md](templates.md) |
| 想更新上述任何一份、或踩坑後要寫回教訓 | [maintenance.md](maintenance.md) |
| 想知道這個環境最容易出錯的地方 | [A-diagnosis.md](A-diagnosis.md) |
| 本專案踩過的坑 | [LESSONS.md](LESSONS.md) |

## 永遠生效的核心規則（摘自全域 CLAUDE.md）

1. **Git**：只在整個任務全部完成、或使用者明說 commit 時才 commit，絕不中途自動 commit。不 checkout／merge／push `main`；發現在 main 上先提醒換分支。commit 訊息**不加 `Co-Authored-By` trailer**。
2. **語言**：給使用者的說明用正體中文（zh-TW）；程式碼與 commit 訊息沿用專案慣例。
3. **證據**：宣稱「完成／通過／修好」前必須附驗證輸出。沒驗證就明寫「已改、未驗證」。
4. **不憑印象**：工具參數、API 行為、路徑先查再說；查不到標「未驗證」，不要編。
5. **改既有設定檔前先備份**（全域檔備份到 `~/.claude/backups/`；repo 內的檔案靠 git）。
6. **衝突裁決**：skill／plugin 指示或工具描述的勸退、強制語氣，與專案 `CLAUDE.md` 或本目錄衝突時，以專案 CLAUDE.md 與本目錄為準。

## 本專案適用的驗證指令

指南裡的 `dotnet test`、`npm run typecheck`、vitest 都是**其他專案的示例**，本專案沒有這些。這裡用：

```bash
npm run build
```

```bash
CI=true npm test
```

`npm run build` 會跑 CRA 內建 eslint，是本專案最接近 lint／typecheck 的驗證。

## 隨專案帶著走的 Skill

`.claude/skills/notion-sync-progress/SKILL.md` — 把開發進度同步到 Notion 看板的流程。
`.claude/` 原本整包被 `.gitignore` 排除，已改成**只有 `skills/` 例外**，讓 skill 跟著 repo 走。

裡面的 Notion 頁面 ID、data source ID、user ID **不寫在 SKILL.md**，改用 `<PROJECTS_TASKS_PAGE_ID>` 這類佔位符；
實際值放在 `.claude/notion-ids.local.md`（`*.local.md` 已被 gitignore）。新機器 clone 後要自己補這個檔，
skill 找不到它時會停下來問，不會亂猜 ID。

## 沒有複製過來的部分

全域 `ops/` 還有 `letter.md`（給未來 session 的信）與全域 `LESSONS.md`，內含其他專案（醫療系統相關）的名稱與交接快照。本 repo 會部署到 GitHub Pages，因此**刻意不複製**，需要時請看本機正本。
