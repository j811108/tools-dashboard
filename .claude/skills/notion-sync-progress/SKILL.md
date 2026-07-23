---
name: notion-sync-progress
description: Sync the current code project's progress to the user's Notion "Projects & Tasks" board. Use when the user asks to "sync to Notion", "更新 Notion 進度", "建 Notion task", "把進度同步到看板", or otherwise wants to mirror dev progress / commits / phases into Notion. Creates one Project row (if missing) and Task rows under it, with Tags / Priority / Status / Due / Completed on / Git-version filled in. Requires the Notion MCP server to be connected to the correct workspace.
---

# Notion 進度同步 Skill

把目前 code 專案的開發進度同步到 Notion 看板「Projects & Tasks」。

## 執行紀律（2026-07-13 增修，依 `docs/ops/A-diagnosis.md` 三大失效模式設計）

1. **context 紀律**（防大輸出灌爆主對話）:全程**不要 fetch 整個「Projects & Tasks」看板頁**——它內含所有 Project/Task 的 inline database,單次回傳可達數萬字。要驗證時只 fetch「單一」頁面(該 Project 頁或某一筆 Task 頁)。`notion-search` 用具體關鍵字,只看前 5 筆結果。
2. **不編造 gate**:下方固定 ID 任何一個查無或 404 → 停下回報使用者,禁止改用搜尋到的「相似」頁面或自行猜 ID 續作。
3. **主對話直接執行**:本 skill 的資料彙整低於 `docs/ops/dispatch.md` §1 的派工門檻,不要為它開 subagent。唯一例外:要彙整超過 50 筆 commit 時,派 haiku 把 git log 整理成清單檔回傳路徑。
4. **repo 不歸本 skill 管**:本 skill 只動 Notion。若同一輪順帶改了 repo 檔案,commit / push 一律依 CLAUDE.md「commit / push 判準」,不在此另立規則。

## 適用情境

使用者說以下任一種:
- 「同步到 Notion」「把進度更新到 Notion」
- 「在 Notion 建一個 Project / Task」
- 「把這次開發成果寫進看板」
- 「同步 commits 到 Notion」

## 前置確認

1. **Notion MCP 已連線且為正確 workspace**。
   - 測試:`mcp__Notion__notion-search` 搜「Projects & Tasks」,結果需含 `<PROJECTS_TASKS_PAGE_ID>`。**不要 fetch 這個看板頁本身**(理由見上方執行紀律第 1 條)。
   - 搜不到或 404 → 提示使用者把 MCP 重新 OAuth 到正確 workspace,停下等回覆。

2. **關鍵 ID 常數**——**不寫在本檔**(本檔會進 git,repo 為公開)。

   實際值放在 **`.claude/notion-ids.local.md`**(已被 `.gitignore` 排除,不會進版控)。本檔一律用下列佔位符,執行前先讀那個檔把佔位符換成實際值:

   | 佔位符 | 內容 |
   |------|---------|
   | `<PROJECTS_TASKS_PAGE_ID>` | Projects & Tasks 看板頁 ID |
   | `<PROJECTS_DATA_SOURCE_ID>` | Projects data source ID |
   | `<TASKS_DATA_SOURCE_ID>` | Tasks data source ID |
   | `<OWNER_USER_ID>` | 預設 Owner / Assignee 的 Notion user ID |
   | `<PROJECT_TEMPLATE_ID>` | Projects DB 預設模板 ID |

   若 `.claude/notion-ids.local.md` 不存在(例如剛 clone 下來)→ **停下來請使用者提供**,禁止用搜尋結果猜 ID(見執行紀律第 2 條)。

## 執行流程

### Step 1 — 確認 Project

先 `mcp__Notion__notion-search` 在 Projects DB 搜目前專案是否已存在(用 repo 名或專案中文名)。

- **不存在** → 用 `mcp__Notion__notion-create-pages` 在 `data_source_id: <PROJECTS_DATA_SOURCE_ID>` 下建立,屬性:
  - `Project name`: 中文專案名
  - `Status`: `In Progress`(或 `Planning`)
  - `Owner`: `["<OWNER_USER_ID>"]`
  - `userDefined:URL`: 線上網址(若有)
  - **`template_id`: `<PROJECT_TEMPLATE_ID>`** ← 一定要帶,這是 Projects DB 的預設模板,會自動生成置底的「Project tasks」inline database(以 Project relation 過濾)。
  - **`content` 不要傳**(會跟 template 衝突)。改成建好後用 `update_page` 的 `insert_content` + `position: {type: "start"}` 把指南文字塞在最上面,模板生成的 Project tasks database 就會保留在最下面。
  - 指南內容包含:🌐 線上服務 / 🛠 維護後台(Vercel / Supabase / GitHub / LINE 等對應到該專案)/ 🧱 技術棧 / 🔑 環境變數 / 📂 開發分支 / 💻 常用指令 / 📐 架構重點 / 📚 文件連結。

- **已存在** → 取得它的 URL(後面 Task 要 relation 過去),必要時更新指南內容,但**禁止**使用 `replace_content`(會把置底的 Project tasks inline database 一併刪除)。要更新指南時:
  - 先 `mcp__Notion__notion-fetch` 抓現有內容(只抓這個 Project 頁,不抓看板),找到指南區塊(通常是 `# 🍱 ...` 標題到 `---` 結束的範圍)。
  - 用 `update_content` 帶 `content_updates: [{ old_str: "<整段舊指南>", new_str: "<整段新指南>" }]` 做精準替換。
  - **`old_str` 絕對不能包含** `<database ...>Tasks</database>` 那一行,也不能跨越「## Project tasks」標題後的內容,否則 inline database 會掉。
  - 若不確定範圍,寧可分多次小範圍 `update_content`,也不要冒險 `replace_content`。

### Step 2 — 整理 Task 清單

從以下來源彙整:
- `docs/開發進度與計畫.md`(若存在)的階段表
- `git log --oneline -50` 的 commit 訊息
- `CLAUDE.md` 內的待辦清單
- 使用者口頭追加的項目

每個 Task 對應 1~多個 commit(填 Git-version 欄位)。

### Step 3 — 批次建立 Tasks

**建立前先去重**:用 `mcp__Notion__notion-search` 以 Task 名稱查詢,若已存在同名且 relation 到同一 Project 的 Task → 不重建,改走「同一 Task 再次更新」流程(見 Task 內文格式最後一條)並視需要更新 properties。重複建立 Task 是本 skill 最常見的髒資料來源。

`mcp__Notion__notion-create-pages` 一次最多 100 筆,parent 為 `data_source_id: <TASKS_DATA_SOURCE_ID>`。

每筆 properties:

| 屬性 | 值 |
|------|---|
| `Task name` | 任務名稱 |
| `Status` | `Done` / `Testing` / `In Progress` / `Not Started` / `Archived`(依下方「Status 判定規則」決定) |
| `Priority` | `Low` / `Medium` / `High` |
| `Tags` | JSON 陣列字串,從 `["Mobile","Website","Meeting","Research","Frontend","Backend","Docs","Version Control","Bugs","DB"]` 挑 |
| `Assignee` | `'["<OWNER_USER_ID>"]'` |
| `Project` | `'["<該 Project 頁面的完整 URL>"]'` |
| `Git-version` | 逗號分隔的 commit short hash(可多筆) |
| `date:Due:start` | `YYYY-MM-DD`(已完成的壓今天或完成日;未完成壓預計日) |
| `date:Completed on:start` | `YYYY-MM-DD`(僅 Done 才填) |
| `content` | 依下方「Task 內文格式」用更新紀錄 + checklist 撰寫 |
| `icon`(create-pages 參數,非 properties) | emoji,依下表挑選 |

> ⚠️ 關係屬性(`Project`、`Tags`、`Assignee`)的值要傳「JSON 字串」,不是物件。

#### 權威來源規則(必做,優先於下方 Status 判定)

若使用者提供了「已定案的 Google Sheet 時程表」(或明說某來源為準),**該來源即權威**:Notion 與其對應/衝突時,一律**以 Sheet 為主**(子項目、內容、備註、日期、進度都照 Sheet)。此規則**凌駕**下方「Status 判定規則」——例如 Sheet 標「完成」但 Notion callout 有未勾選項,仍標 `Done`(不是 `Testing`)。

- Sheet 一列對應 Notion 一個 Task;若 Notion 曾把多列**合併**成一個 Task,嵌入表格要**還原成 Sheet 的多列**。
- Sheet 有、Notion 缺的列 → **補建 Task**。
- 進度對應:完成→`Done`、測試中→`Testing`、進行中→`In Progress`、未開始→`Not Started`、失敗/取消 → 用該名稱的 Status(或記於表格「進度」欄)。

#### 可貼回 Sheet 的表格(必做,當使用者要求「能複製到時程表」時)

在每個 Task 內文(callout 之後、以 `---` 分隔)嵌入一個**靜態、不走 DB 的表格**,欄位固定為:
`子項目 | 內容 | 備註 | 負責人 | 預計開始時間 | 進度 | 預計完成時間 | 實際完成時間 | 開發人員備註`。
用 `<table header-row="true">…<tr><td>…</td></tr></table>`(不是 database)。合併任務放多列。沒有的欄位留空 `<td></td>`。
- 用 `insert_content` + `position:end` 附加;之後修正用 `update_content` 針對該資料 `<tr>`。
- ⚠️ Notion 會把 `xxx.sh` / `xxx.py` / `.md` 等自動轉成連結,`update_content` 的 `old_str` 必須用 **fetch 後的實際內容**(含 `[deploy.sh](http://deploy.sh)` 這種 markup)才比對得到;不確定就先 `fetch`。

#### Status 判定規則(必做,優先於「commit 是否合併」;但低於上方權威來源規則)

不可只看 commit 已合併就標 Done。依 callout 的 checklist 勾選狀態 + Spec/Plan 完成度符號判定:

- **`Done`** — callout 內全部 `- [x]`,且無 🚧/⏳(Spec/Plan 完成度 ✅,或本 Task 無 Spec)。只有 Done 才填 `date:Completed on:start`。
- **`Testing`** — 主要功能已完成,但 callout 仍有 `- [ ]` 未勾選(待測/待確認/提醒殘留)或 Spec 完成度為 🚧。**清空 `date:Completed on:start`**(未真正完成不留完成日)。`Testing` 位於 Status 的 in_progress 群組(黃色),名稱固定為 `Testing`。
- **`In Progress`** — 主要功能尚未完成。
- **`Not Started`** — 尚未動工。

同步時若發現既有 Task 違反此規則(例:callout 有未勾選卻標 Done),用 `update_properties` 改成 `Testing` 並清空 `date:Completed on:start`。此規則涵蓋並取代下方 Spec/Plan 段落較舊的「有 🚧/⏳ 才設 In Progress」寫法——有殘留一律先進 `Testing`,不是 `In Progress`。

### Task 內文格式(content)

> ⚠️ **版式已定稿,不要再改**:歷史上 checklist→toggle→callout 來回 3 版才收斂(教訓紀錄見 `docs/ops/judgment.md`)。想動版式屬 🟡 級變更——先問使用者,拿到同意才改。

每筆 Task 的內文用「callout 更新紀錄」格式:整段放在 callout 卡片裡,日期 + 大綱當粗體小標(大綱要能帶出這次更新的原因),checklist 項目列在下面。callout **預設展開**,一進來就看得到(Notion 的 toggle 無法預設展開,故改用 callout)。

```
<callout icon="<emoji>" color="gray_bg">
	**<日期 M/D> <大綱(帶出更新原因)>**
	- [ ] 未完成或不需要的項目(可加（不需）/（待確認）等註記)
	- [x] 已完成的項目
</callout>
```

規則:
- 用 `<callout icon="…" color="gray_bg">…</callout>`;卡片內所有行用 **tab 縮排**。
- 第一行是 `**日期 + 大綱**`(粗體),大綱要讓人一看就知道**為什麼更新**(原因由內容帶出,不另寫「更新原因」標題)。日期格式 `M/D`;未完成的可用預計日或「未排程」。
- checklist 用 `- [ ]`(未做/不需)與 `- [x]`(已完成)。
- 註記用全形括號（不需）/（待確認),避免 `<>` 與標籤混淆。`- [ ]` 中括號內務必留一個空格,否則不會渲染成核取方塊。
- icon 用該 Task 的 emoji(與頁面 icon 一致);color 統一用 `gray_bg`。
- 同一 Task 再次更新時,把新的 `<callout>` 卡片插在內文「最上面」(用 update-page 的 `insert_content` + `position: start`),舊卡片往下保留,最新在上;不要 `replace_content` 蓋掉舊紀錄。

範例:
```
<callout icon="💬" color="gray_bg">
	**7/23 庫存表新增「展威」來源,倉庫名稱含既有關鍵字需調整判斷順序**
	- [x] OUTPUT_COLUMNS 新增展威欄
	- [x] 區塊判斷把「展威」排到平台/總倉之前
	- [ ] 用實際來源檔驗證匯出欄位（待確認）
</callout>
```

### Spec / Plan 大綱嵌入(必做)

目標:**在 Task 卡片內就能看到這次的修改範圍、修改重點**,不必再開 spec/plan 檔。

#### 何時觸發

Task 的 commits 或描述,有對應到 `docs/superpowers/specs/*.md` 或 `docs/superpowers/plans/*.md`(或專案內等同的設計/計畫文件)時,**必須**嵌入該文件大綱。判斷方式:
1. `git show --stat <hash>` 看是否動到 `docs/superpowers/specs|plans/*.md`,或
2. commit message 提到 `feat: xxx` 但同期有相關 `docs/...md` 出現,或
3. 使用者口頭指明關聯文件。

一個 Task 可關聯多個文件(spec + plan 通常成對出現),全部嵌入。

#### 完成度判定

對該 Task 涵蓋的 spec/plan,要先**確認是否已完成**,再決定狀態符號:
- 讀檔(`Read` tool)抓內文,看是否仍有 `- [ ]` 未勾選項目、`TODO`、`待定`、`Phase X(未開始)`。
- 對照已建立 Task 的 `Status` / 對應 commits 是否齊全。
- 結果歸類:
  - ✅ **已完成** — 所有大綱項目皆已實作 + 通過測試
  - 🚧 **進行中** — 部分完成
  - ⏳ **未開始** — 僅有設計,尚未動工

#### 嵌入格式

在 callout 內部、checklist 之後,加一條分隔線 `---`,再放「📐 Spec / Plan 大綱」區塊。**全部留在同一個 callout 裡**(callout 預設展開,使用者一進來就看到)。

```
<callout icon="<emoji>" color="gray_bg">
	**M/D 大綱(帶出更新原因)**
	- [x] checklist 項目 1
	- [x] checklist 項目 2
	---
	**📐 Spec / Plan 大綱** · 完成度 ✅
	📄 `docs/superpowers/specs/<檔名>.md`
	1. <區塊 1 H2/H3 標題> — ✅
	2. <區塊 2> — ✅
	3. <區塊 3> — 🚧(原因簡述)
	4. <區塊 4> — ⏳
	📄 `docs/superpowers/plans/<檔名>.md`
	- Phase 1 <名稱> — ✅
	- Phase 2 <名稱> — 🚧
	- Phase 3 <名稱> — ⏳
</callout>
```

規則:
- **大綱來源**:抓 spec 的 H2(`##`)/ plan 的 Phase 或 Step 區塊標題,**最多 8 條**;超過時挑最能代表「修改重點」的合併或省略,並在結尾補一條「…等 N 項」。
- **每條後面接狀態符號**:✅ 已完成 / 🚧 進行中 / ⏳ 未開始。進行中可在括號中加 1 行原因(≤ 20 字)。
- **頂端的完成度符號**用 spec/plan 中最差的那個(全 ✅ → ✅;有任一 🚧 → 🚧;全 ⏳ → ⏳)。
- **Status 連動規則(必做)**:依前面「Status 判定規則」——大綱中存在任何 🚧 或 ⏳(頂端完成度非 ✅)時,若主要功能已完成 → 設 `Testing`;主要功能未完成 → `In Progress`;**一律不可標 `Done`**,只有全 ✅ 才能 `Done`。原因:spec/plan 沒做完代表這個 Task 還沒收尾,不該在看板上以 Done 消失。同步時若發現既有 Task 違反此規則,用 `update_properties` 改成 `Testing`(主功能完成)或 `In Progress`(主功能未完),並清空 `date:Completed on:start`。
- 多檔以 `📄` 區隔,每檔自成一段。
- 檔案路徑用反引號包,**不**用 Notion link(避免 Notion 解析失敗)。
- 純文件型 Task(Tags 只有 `Docs`、commit 只動 spec/plan)同樣要嵌入大綱,讓人從 Task 直接讀到設計重點,**不需重複「任務內容/改動檔案」段落**。
- 若 Task 沒有對應 spec/plan,**不需強加**這個區塊。

### Icon 對照(依 Tags 決定,有優先順序;由上而下,撞到先取)

| 條件 | Icon | 說明 |
|------|------|------|
| `Bugs` | 🐛 | bug 永遠優先 |
| `DB` 且 `Backend` | 🗄️ | 資料庫遷移/RLS/schema |
| `DB` | 💾 | 純資料層 |
| `Backend` 含 `Mobile` | 🔔 | LINE 通知 / cron / push |
| `Backend` | ⚙️ | API / server-side |
| `Mobile` 含 `Frontend` | 📱 | LIFF / Mobile-first UI |
| `Mobile` 含 `Docs` | 🤝 | LINE OA / Rich Menu 文件 |
| `Mobile` | 📲 | 純行動端 |
| `Frontend` | 🎨 | UI / 元件 |
| `Docs` | 📝 | 文件/說明 |
| `Version Control` | 🔀 | git / branch / commit 規範 |
| `Meeting` | 💬 | 會議追蹤 |
| `Research` | 🔍 | 研究/探索 |
| `Website` | 🌐 | 純網站類 |
| (無 tag) | 📋 | fallback |

> 多 tag 時,從上往下找第一個命中的條件。例如 `["Backend","Mobile"]` → 🔔;`["Frontend","DB"]` → 💾(無 Backend,直接落到 `DB`)。

### Step 4 — 清理舊資料(可選)

若使用者要求刪除/合併舊 Task:
- Notion API 無真實 delete,改用 `update_properties` 設 `Status: "Archived"` 並把 `Project: "[]"` 清空。

### Step 5 — 驗證與回報

<!-- 列出表格給使用者看:|Task|Status|Priority|Tags|Git|,並附上 Notion 頁面連結。 -->
1. 抽驗:對「新建的第一筆」Task 用 `mcp__Notion__notion-fetch` 抓該頁(單頁,非看板),確認 properties 與 callout 內文真的存進去——properties 錯通常是整批錯,抽驗一筆即可代表全批。
2. 回報結論先行:第一句講「新建 X 筆、更新 Y 筆、跳過(已存在)Z 筆,已抽驗」,再列表格 |Task|Status|Priority|Tags|Git|,附 Project 頁連結。

## Tag 對照建議

| 內容類型 | 建議 Tags |
|---------|----------|
| 前端 UI / 元件 | `Frontend` |
| 後端 API / Cron | `Backend` |
| 資料表 / Migration | `DB` |
| Supabase / RLS / Auth | `Backend`, `DB` |
| LIFF / LINE 通知 | `Mobile` |
| Rich Menu / OA 文件 | `Mobile`, `Docs` |
| PWA / 設定頁 | `Frontend` |
| Bug 修復 | `Bugs` + 對應端 |
| 文件更新 | `Docs` |
| 部署 / branch / commit 規範 | `Version Control` |

## 注意事項

- ⚠️ **絕對不要用 `replace_content` 改 Project 頁面**,會把置底的 Project tasks inline database 一起刪掉。改用 `update_content` 做精準 search-replace,且 `old_str` 不可包含 `<database>` tag。
- ⚠️ **新建 Project 一定要帶 `template_id: <PROJECT_TEMPLATE_ID>`**,模板會自動產生置底的 Tasks inline database;此時不要同時傳 `content`,改成建好後 `insert_content` 從 `position: start` 塞指南。
- **不要**主動 commit / push 任何 code,只負責 Notion 端操作。
- 本 skill 只負責 Notion 端操作;repo 的 commit / push 一律依 CLAUDE.md「commit / push 判準」判斷,本檔不另立規則(雙源規則會打架,見 `docs/ops/A-diagnosis.md`)。
- 若使用者沒指定 owner,預設用 `<OWNER_USER_ID>`。
- 多個 commit 屬同一 Task 時,Git-version 用 `hash1, hash2, hash3` 格式。
- 描述用**正體中文**,符合使用者既有專案慣例。
- 建立後再 `mcp__Notion__notion-fetch` 確認一筆,保證 properties 真的存進去。