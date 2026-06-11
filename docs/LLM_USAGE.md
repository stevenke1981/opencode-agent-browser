# LLM 使用說明 — opencode-agent-browser

本文件說明 LLM 如何**自動判斷**何時使用 browser 工具、如何呼叫、以及常見流程範例。
Plugin 會依使用者訊息意圖自動注入精簡版指引；也可用 `/browser-guide` 手動載入。

---

## 一、何時應該使用 browser* 工具

符合以下**任一條件**即應優先使用 `browser*` tools，不要用 bash `agent-browser`、Playwright、Puppeteer 或單純 curl 抓 HTML：

| 情境 | 使用者可能說 |
|------|-------------|
| 開啟網址 | 「打開 https://example.com」「去登入頁」 |
| 與頁面互動 | 點擊、填表、送出、選下拉、上傳 |
| 視覺驗證 | 截圖、「按鈕有沒有出現」「版面對不對」 |
| 讀取動態內容 | SPA 渲染後的文字、即時 DOM |
| 登入 / 登出 | 測試需登入的流程 |
| Web QA / E2E | 測試 web app、探索式 QA、重現 UI bug |
| 本機 dev server | `http://localhost:3000` 前端改完要驗證 |
| 關鍵字 | browser、website、screenshot、login、form、QA |

**Session 起迄：**
1. 第一次用瀏覽器 → `browserDoctor`
2. 完成所有操作 → `browserClose`

---

## 二、何時不應該使用

| 情境 | 改用 |
|------|------|
| API 回 JSON 就夠 | curl / fetch / HTTP client |
| 讀專案原始碼 | Read / Grep |
| Git、建置、改檔案 | git* tools / shell / 編輯器 |
| 靜態文件查詢 | WebSearch / Read |
| 只寫 code、不需 live 驗證 | 略過 browser |
| 純後端邏輯 | 單元測試 / code review |

---

## 三、標準操作流程

```
browserOpen(url)
  → browserSnapshot()              # 取得 @e1 @e2 …
  → browserClick / browserFill / browserFind
  → browserWait(載入完成或元素出現)
  → browserSnapshot()              # 頁面變了必須重拍
  → …重複…
  → browserClose()
```

**鐵則：**
1. 每次用 `@eN` 前都要先 `browserSnapshot`
2. 點擊、送出、導頁、開 modal 後**必須**再 snapshot（ref 會失效）
3. 用 `browserWait` 等載入，少用盲目 `mode=ms`
4. 同一 session 內 browser 會保持開啟，直到 `browserClose`

---

## 四、工具對照表

| Tool | 何時呼叫 | 主要參數 |
|------|----------|----------|
| `browserDoctor` | 第一次用、出錯時 | — |
| `browserSkills` | 複雜流程前讀文件 | `skill: "core"` |
| `browserOpen` | 開啟 URL | `url` |
| `browserSnapshot` | 看可互動元素 | `interactive: true` |
| `browserClick` | 點擊 | `target: "@e2"` |
| `browserFill` | 清空並輸入 | `target`, `text` |
| `browserType` | 追加輸入 | `target`, `text` |
| `browserPress` | 按鍵 | `key: "Enter"` |
| `browserGet` | 讀 title/url/text | `what`, `target` |
| `browserFind` | 語意定位 | `locator`, `value`, `action` |
| `browserWait` | 等待載入/元素 | `mode`, `value` |
| `browserScreenshot` | 截圖 | `path`（可選） |
| `browserNavigate` | 上一頁/重新整理 | `action` |
| `browserBatch` | 多步驟腳本 | `commands[]` |
| `browserRun` | 進階子命令 | `command`, `args` |
| `browserClose` | 結束 | `all`（可選） |

**共用參數：**
- `browser: "chrome"`（預設，Chrome 正式版）或 `"brave"`
- `headed: true` — 除錯時顯示視窗
- `profile` / `sessionName` — 重用登入狀態

---

## 五、呼叫範例

### 開啟並讀取頁面

```
browserOpen({ url: "https://example.com" })
browserWait({ mode: "load", value: "networkidle" })
browserGet({ what: "title" })
browserSnapshot({ interactive: true })
browserClose({})
```

### 搜尋並點擊結果

```
browserOpen({ url: "https://duckduckgo.com" })
browserSnapshot({})
browserFill({ target: "@e1", text: "opencode" })
browserPress({ key: "Enter" })
browserWait({ mode: "load", value: "networkidle" })
browserSnapshot({})
browserClick({ target: "@e5" })
browserClose({})
```

### 登入流程

```
browserOpen({ url: "https://app.example.com/login" })
browserSnapshot({})
browserFill({ target: "@e3", text: "user@example.com" })
browserFill({ target: "@e4", text: "<password>" })
browserClick({ target: "@e5" })
browserWait({ mode: "url", value: "**/dashboard" })
browserSnapshot({})
```

### 截圖本機 dev server

```
browserOpen({ url: "http://localhost:3000" })
browserWait({ mode: "load", value: "networkidle" })
browserScreenshot({ path: "ui-check.png", fullPage: true })
browserClose({})
```

### 改用 Brave

```
browserOpen({ url: "https://example.com", browser: "brave" })
```

---

## 六、瀏覽器政策

| 允許 | 禁止 |
|------|------|
| Chrome 正式版（預設） | Chromium |
| Brave（`browser: "brave"`） | Chrome for Testing |
| | `agent-browser install` 下載的瀏覽器 |

切換 Chrome ↔ Brave 前須先 `browserClose`。

---

## 七、Plugin 如何引導 LLM

| 層級 | 機制 | 作用 |
|------|------|------|
| 1 | `config.instructions` | 每次 session 的簡短決策規則 |
| 2 | `chat.messages.transform` | 偵測到瀏覽器意圖時注入完整指引 |
| 3 | `session.compacting` | Context 壓縮後保留流程摘要 |
| 4 | `/browser-guide` | 使用者手動觸發完整說明 |

意圖偵測關鍵字包含：browser、website、screenshot、login、localhost、https://、QA、登入、截圖、網頁測試等。

---

## 八、疑難排解

| 問題 | 處理 |
|------|------|
| ref 失效 / 點不到 | 重新 `browserSnapshot` |
| 白屏 / 轉圈 | `browserWait mode=load value=networkidle` |
| 第一次就失敗 | `browserDoctor` |
| 用到錯誤瀏覽器 | `browserClose` 後指定 `browser: "chrome"` 或 `"brave"` |
| 流程不熟 | `browserSkills skill=core` |