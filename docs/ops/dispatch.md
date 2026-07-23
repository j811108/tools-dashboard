# C. 模型調度守則

適用對象：未來每個主對話模型（Sonnet/Opus/Haiku）。目的：主對話保持小而清醒，粗重活派出去。

## 0. 環境事實（2026-07-03 查證，2026-07-13 第三次複驗有更新；每次 session 首次派工前花 10 秒對照當下 Agent tool schema，不符就照 maintenance.md 流程更新本節）

- Agent tool 的 `model` 參數可選：`sonnet`、`opus`、`haiku`、`fable`。**沒有 effort 參數**——這是 harness 極限，無法對 subagent 指定思考深度，只能靠 prompt 寫清楚範圍來控制。
- **Subagent 預設跑在背景**（2026-07-13 查證）：派出後不會立刻拿到結果，完成時 harness 會通知你。需要「拿到結果才能繼續」（驗收、研究答案影響下一步）→ 派工時加 `run_in_background: false` 同步等待。可平行的粗活（多路搜尋、批次改檔）就留背景，別派完傻等，繼續做別的。
- `isolation` 參數有 `"worktree"` 與 `"remote"` 兩值（2026-07-13 查證）。`worktree` 給獨立 git 工作區；`remote` 跑在雲端且可能受方案限制——沒把握就不指定或用 worktree。
- 可用 `subagent_type`：
  - `Explore` — 唯讀搜尋（不能 Edit/Write）。掃 repo、找定義、盤點用法。**限用於定位，不要用於審查或跨檔一致性分析**（它讀節錄，會漏讀窗外內容）。
  - `Plan` — 唯讀規劃（不能 Edit/Write）。產實作計畫。
  - `general-purpose` — 全工具。實作、重構、批次改檔、驗證、代呼叫大 payload 的 MCP 工具。
  - `claude` — 全工具的萬用型，是 harness 未指定型別時的預設值；功能同 general-purpose。本守則一律寫 general-purpose，兩者等價，看到任一名字都指同一類。
  - `claude-code-guide` — 只回答 Claude Code/API 本身的問題。
- `SendMessage` 可以延續已派過的 agent（保留其 context）；重新 `Agent` 呼叫是全新冷啟動。`SendMessage` 屬 deferred tool（見下條）。
- `isolation: "worktree"` 使用判準：涉及刪檔、rename、或改動 5 個以上檔案。
- **Deferred tools**（2026-07-13 查證）：部分工具（`WebFetch`、`WebSearch`、`SendMessage`、`TaskCreate` 等，清單見 session 開頭的 system-reminder）預設只列名字、schema 未載入，直接呼叫會報 InputValidationError。用前先 `ToolSearch` 以 `select:工具名1,工具名2` **一次批次載入**全部會用到的，不要一個一個載。
- **工具描述的勸退文字 vs 本守則**（2026-07-13 觀察）：Agent tool 描述可能寫著「Do not spawn agents unless the user asks… expensive path on this plan」。裁決規則：使用者的 CLAUDE.md 與本守則是明文授權，優先於工具描述的預設勸退——該派就派，不要因為那段話放棄整套派工制度。但把它當**成本訊號**：派工前先過 §1 末的「可自己做」例外判準，能用 Grep 定位＋offset/limit 讀完的就自己做，派工留給真正的大掃描與大 payload。

## 1. 指揮官不下場

主對話**只做**：理解需求、拆任務、派工、收結論、對使用者說話、最終整合。
以下一律派 subagent，主對話只收結論：

| 任務 | 派 | model |
|---|---|---|
| 掃 repo / 找所有用法 / 「X 在哪」 | Explore | haiku（範圍明確）/ sonnet（範圍模糊） |
| 讀 3 個以上大檔提煉答案 | Explore | sonnet |
| 查網頁 / 讀外部文件 | general-purpose | sonnet |
| 大 payload MCP 呼叫（Notion 整頁、瀏覽器整頁、批次外部資源） | general-purpose | sonnet |
| 機械式批次改檔（模式已定） | general-purpose | haiku |
| 實作一個功能 / 修一個 bug | general-purpose | sonnet |
| 架構設計 / 跨層重構規劃 | Plan | opus |
| 驗收別人的產出 | general-purpose（fresh context） | sonnet |

表內 model 皆為 Agent tool 合法值（`sonnet`/`opus`/`haiku`）；`fable` 勿指定（見 §6）。若指定的 model 報錯，改用 `opus` 重派。

例外（主對話可以自己做）：讀單一小檔（<200 行）、Grep 定位後用 offset/limit 讀 2 個以內的區段、跑一條指令、改 3 個以內已定位好的小 edit。判準：**動手前能一句話說出要改哪裡、怎麼改**，就自己做；說不出來就先派 Explore。

## 2. 派工三件套（每個 Agent prompt 必含，模板見 templates.md）

1. **目標與動機**：要做什麼＋為什麼（讓 agent 遇到岔路能自己判斷）。
2. **驗收條件**：明確可檢查的完成定義（「測試 X 通過」「回報所有符合 Y 的 檔案:行號」）。
3. **回報格式**：規定只回結論。禁止貼整檔內容回來。

## 3. 回報合約

- Subagent 只回：結論、`檔案:行號` 清單、變更摘要、驗證輸出的關鍵行。
- 長產物（報告、大量分析）→ 落檔到 scratchpad 或 `docs/`，回傳路徑。
- Agent 的回覆使用者看不到——主對話要轉述重點，不能只說「agent 做完了」。

## 4. 升降級路徑

- **haiku 錯一次** → 直接升 sonnet 重派（不要給 haiku 第二次機會，重試比升級貴）。
- **sonnet 同一子任務連錯兩次** → 帶完整失敗軌跡（做了什麼、錯誤訊息全文、已排除的假設）升 opus。
- **opus 解出模式後** → 把解法寫成明確步驟，降回 haiku/sonnet 批次套用到其餘同型案例。
- **重試計數每個模型層級各自計算**：haiku 錯一次即升；sonnet 連錯兩次即升；opus 再連錯兩次＝整條升級鏈耗盡 → 停下，向使用者報告失敗軌跡與建議選項（見 judgment.md「該停下來問」）。
- **次數門檻（本節）與訊號判準（judgment.md §1）是 OR 關係：任一先滿足就升級。** 例：haiku 才錯 0 次但已出現「修 A 壞 B」訊號 → 直接升，不必等次數到。

## 5. 驗證不自驗

寫程式的 agent 不能自己宣稱驗收通過。驗收一律派 **fresh-context** 的 general-purpose agent（新呼叫，不帶實作對話；加 `run_in_background: false`——驗收結果決定下一步，必須同步等）：

- **檔案類產出** → read-back：重新讀檔，逐項對照驗收條件。
- **程式碼** → 跑測試或實跑。指令依當下專案技術棧與其 CLAUDE.md 決定（.NET 後端用 `dotnet test`、前端用 `npm run typecheck`/vitest 等）；只跑相關 filter，不跑全套。
- **高風險判斷**（資料遷移、刪除、安全性、對外發布）→ 加第二意見：再派一個 opus agent 獨立評估，或產 2–3 個候選方案由評審 agent 選優。
- 驗證 agent 的 prompt 不要透露「預期會通過」，只給驗收條件，讓它中立檢查。

## 6. Harness 極限（誠實條款）

- 無法指定 subagent 的 effort/思考深度；只能用 prompt 收窄範圍。
- 拆解＋驗證＋多樣本評審能補「執行品質」，補不了「品味與模糊題」（例：UI 好不好看、文案語氣、產品取捨）。遇到 → 升 opus 出 2–3 案給使用者選，或明說「這題需要人的判斷」。
- `fable` 模型在 schema 裡存在（2026-07-13 仍在）但未來不一定可用、且可能受方案限制；派工時不要指定 `fable`，若指定後報錯即改用 `opus`。

## 變更記錄
- 2026-07-04 Fable 5 補 claude 型別、Explore 限制、MCP 派工列、model 合法值註記、升級門檻 OR 語義。
- 2026-07-13 Fable 5 第三次複驗：補 subagent 背景執行預設、isolation remote 值、deferred tools/ToolSearch、工具描述勸退文字的裁決規則；例外判準補 offset/limit 區段讀取。
