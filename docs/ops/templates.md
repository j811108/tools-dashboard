# E. 派工 Prompt 模板

用法：複製對應模板，填掉所有 `{...}`，經 Agent tool 派出。空著的欄位＝你還沒想清楚，先想清楚再派。
共同規則：subagent 看不到主對話，**所有背景都要寫進 prompt**；路徑一律絕對路徑。
模板內的驗證指令（`dotnet test`、`npm run typecheck` 等）是**示例**，派工前按當下專案的技術棧與 CLAUDE.md 替換，勿照抄（純 .NET 專案沒有 npm）。

---

## 1. 搜尋／盤點（subagent_type: Explore，model: haiku 或 sonnet）

```
目標：找出 {要找什麼，例如「所有呼叫 InvalidateActiveAsync 的位置」}。
動機：{為什麼找，例如「要評估改簽章的影響範圍」}。
範圍：{目錄或 glob，例如 C:\Projects\LHC_dashboard\backend\**\*.cs}；搜尋廣度：{medium|very thorough}。
驗收條件：涵蓋 {範圍} 內全部命中；每筆含一行上下文說明其用途。
回報格式：條列 `檔案:行號 — 一句話說明`。不要貼大段程式碼，不要建議修改。
```

## 2. 實作（subagent_type: general-purpose，model: sonnet）

```
目標：{做什麼，一句話}。
動機：{為什麼，讓你遇到岔路能對齊意圖}。
背景：{相關檔案清單＋每個檔案為什麼相關；既有慣例，例如「API 回應一律 {ok,data,error} 信封」}。
限制：{不准動什麼，例如「不改 DTO 契約」「不 commit」「不動 main 分支」}。
驗收條件：
1. {行為條件，例如「PUT /api/p2/{id} 在 sections 未變時不使簽名失效」}
2. {驗證指令，例如 dotnet test tests/LHC.Tests/LHC.Tests.csproj --filter "FullyQualifiedName~SignaturesEndpointsTests" 全綠}
3. {不回歸條件，例如 npm run typecheck 乾淨}
回報格式：改了哪些檔（檔案:行號）＋每處一句話理由＋驗證指令的關鍵輸出行。失敗時回報：嘗試過什麼、錯誤全文、卡在哪。
```

## 3. 重構（subagent_type: general-purpose，model: sonnet；涉及刪檔、rename、或改動 5 個以上檔案時加 isolation: "worktree"）

```
目標：{重構什麼 → 變成什麼形狀}。
動機：{現在的痛，例如「三處重複的簽名組裝邏輯」}。
不變式（最重要）：對外行為完全不變——{列出可觀察行為，例如「API 回應 JSON 逐欄位相同」「既有測試零修改全綠」}。
範圍：{哪些檔案可動、哪些絕對不可動}。
驗收條件：
1. {全部既有測試指令} 零修改通過（若必須改測試，逐條說明為什麼）。
2. {重複/壞味道} 已消除，無新增 public API。
回報格式：變更清單（檔案:行號）＋測試輸出關鍵行＋任何你判斷有風險的點。
```

## 4. 研究（subagent_type: general-purpose，model: sonnet；純內部程式庫問題改用 Explore）

```
問題：{要回答什麼，寫成可判定的問句}。
動機：{答案會影響什麼決定}。
資料來源優先序：{官方文件 URL / repo 內 docs/superpowers/specs / 程式碼本身}。
驗收條件：每個結論附來源（URL 或 檔案:行號）；區分「文件明說」與「你的推斷」；查不到就寫查不到，不准編。
回報格式：先一段結論（≤5 行），再列證據。超過 50 行的完整分析落檔到 {scratchpad 路徑}，回傳路徑。
```

## 5. 審查／驗收（subagent_type: general-purpose，model: sonnet；高風險用 opus）

```
你是驗收者，與實作者無關，不要假設實作是對的。
受審產出：{檔案清單或 branch diff 範圍}。
原始需求（逐條）：
1. {需求子句 1}
2. {需求子句 2}
驗收方法：
- 檔案 → 重新讀取，逐條對照上列需求。
- 程式碼 → 實跑 {測試指令}，並檢查 {專案慣例，例如「DTO 前後端同步」「信封格式」}。
回報格式：每條需求標 PASS/FAIL/UNVERIFIABLE＋證據（檔案:行號 或 測試輸出行）。發現需求外的問題另列「附帶發現」，不算 FAIL。
```

---

## 派工前 10 秒自檢

- [ ] 三件套齊了（目標動機／驗收條件／回報格式）？
- [ ] model 按 dispatch.md §1 的表選了？
- [ ] prompt 裡的路徑是絕對路徑？
- [ ] 驗收條件是「可判定」的（有指令、有數字、有清單），不是「品質良好」這種空話？

## 變更記錄
- 2026-07-04 Fable 5 加「示例指令勿照抄」提醒。
