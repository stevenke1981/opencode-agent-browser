export const GUIDANCE_MARKER = "<AGENT_BROWSER_PLUGIN>";

/** Always-on config instruction (short decision rules). */
export const BROWSER_CONFIG_INSTRUCTION = `opencode-agent-browser decision rules:
USE browser* tools when the task needs a real browser: open URLs, interact with live pages (click/fill/submit), screenshots, login flows, web QA, scraping rendered DOM, testing localhost dev servers, verifying UI after frontend changes.
DO NOT use browser* tools when: curl/fetch/API suffices, reading local source files, explaining code without live verification, git/file/shell tasks, or static docs lookup.
First browser action in a session: browserDoctor. Last action: browserClose.
Never raw agent-browser/bash/Playwright/Puppeteer. Browser: Chrome stable (default) or brave only.`;

/** Injected when user message matches browser intent. */
export const BROWSER_TOOLS_GUIDANCE = `${GUIDANCE_MARKER}
# Browser Automation Tools (opencode-agent-browser)

You have \`browser*\` plugin tools wrapping agent-browser. **Prefer them** over raw \`agent-browser\` bash, Playwright, Puppeteer, curl-to-HTML, or built-in web fetch.

---

## 1. When to USE (decision checklist)

Use browser tools if **any** of these is true:

| Signal | Example user request |
|--------|---------------------|
| Open / visit a URL | "open https://example.com", "go to the login page" |
| Interact with a page | click, fill form, submit, select dropdown, upload |
| Visual verification | screenshot, "does the button show?", UI layout check |
| Live page content | scrape rendered text, read dynamic SPA content |
| Auth / session | login, logout, test authenticated flows |
| Web QA / E2E | test web app, exploratory QA, reproduce UI bug |
| Local dev server | test http://localhost:3000 after frontend change |
| User mentions | browser, website, web app, screenshot, login, form, QA |

**Start:** \`browserDoctor\` (first time in session) → \`browserOpen\`
**End:** \`browserClose\` when done (frees browser; required before switching chrome↔brave)

---

## 2. When NOT to use

| Situation | Use instead |
|-----------|-------------|
| API returns JSON/XML | HTTP client / curl / fetch |
| Read project source code | Read / Grep tools |
| Git, build, npm, file edits | git* tools / shell / editor |
| Static docs (MDN, README) | WebSearch / Read |
| User only wants code written, no live test | Skip browser |
| Backend-only logic, no UI | Unit tests / code review |

---

## 3. Core workflow (always follow)

\`\`\`
browserOpen(url)
  → browserSnapshot()          # get @e1 @e2 @e3 refs
  → browserClick(@eN) / browserFill(@eN, text) / browserFind(...)
  → browserWait(mode, value)   # after navigation or async UI
  → browserSnapshot()          # REQUIRED after page change — refs go stale
  → ... repeat ...
  → browserClose()
\`\`\`

**Golden rules:**
1. **Snapshot before every ref interaction** — never guess @eN from memory
2. **Re-snapshot after** click, submit, navigation, modal, tab switch
3. **Wait smartly** — \`browserWait mode=load value=networkidle\` or \`mode=text\` / \`mode=url\`; avoid \`mode=ms\` unless debugging
4. **One session** — browser persists across tool calls until \`browserClose\`

---

## 4. Tool reference (what to call when)

| Tool | Call when | Key args |
|------|-----------|----------|
| \`browserDoctor\` | First browser task; something fails | — |
| \`browserSkills\` | Complex/unfamiliar flow; need patterns | skill: "core" |
| \`browserOpen\` | Navigate to URL | url |
| \`browserSnapshot\` | See interactive elements | interactive: true (default) |
| \`browserClick\` | Click button/link/ref | target: "@e2" |
| \`browserFill\` | Clear + type in input | target, text |
| \`browserType\` | Append text without clearing | target, text |
| \`browserPress\` | Enter, Tab, shortcuts | key: "Enter" |
| \`browserGet\` | Read title/url/text/value | what: "title" / "text", target |
| \`browserFind\` | No snapshot yet; semantic locate | locator: "role", value, action, name |
| \`browserWait\` | Page loading / element appearing | mode: load/text/url/element |
| \`browserScreenshot\` | Capture visual state | path (optional) |
| \`browserNavigate\` | Back / forward / reload | action |
| \`browserBatch\` | Known multi-step script | commands: ["open …", "snapshot -i", …] |
| \`browserRun\` | Unlisted subcommand (eval, cookies, tab) | command, args |
| \`browserClose\` | Task complete or switch browser | all: false |

**Common options (all tools):**
- \`browser: "chrome"\` (default) or \`"brave"\`
- \`headed: true\` — show window for debugging
- \`session\` — parallel isolated sessions
- \`profile\` / \`sessionName\` — reuse login state

---

## 5. Call examples (copy patterns)

### Open and read a page
\`\`\`
browserOpen({ url: "https://example.com" })
browserWait({ mode: "load", value: "networkidle" })
browserGet({ what: "title" })
browserSnapshot({ interactive: true })
browserClose({})
\`\`\`

### Search and click
\`\`\`
browserOpen({ url: "https://duckduckgo.com" })
browserSnapshot({})
browserFill({ target: "@e1", text: "opencode" })
browserPress({ key: "Enter" })
browserWait({ mode: "load", value: "networkidle" })
browserSnapshot({})
browserClick({ target: "@e5" })
browserClose({})
\`\`\`

### Login flow
\`\`\`
browserOpen({ url: "https://app.example.com/login" })
browserSnapshot({})
browserFill({ target: "@e3", text: "user@example.com" })
browserFill({ target: "@e4", text: "<password>" })
browserClick({ target: "@e5" })
browserWait({ mode: "url", value: "**/dashboard" })
browserSnapshot({})
\`\`\`

### Screenshot localhost dev server
\`\`\`
browserOpen({ url: "http://localhost:3000" })
browserWait({ mode: "load", value: "networkidle" })
browserScreenshot({ path: "ui-check.png", fullPage: true })
browserClose({})
\`\`\`

### Semantic find (no prior snapshot)
\`\`\`
browserFind({ locator: "role", value: "button", action: "click", name: "Submit" })
\`\`\`

### Use Brave instead of Chrome
\`\`\`
browserOpen({ url: "https://example.com", browser: "brave" })
\`\`\`

---

## 6. Browser policy

- **Allowed:** Chrome stable (default), Brave (\`browser: "brave"\`)
- **Forbidden:** Chromium, Chrome for Testing, \`agent-browser install\` bundled browser
- **Never** run \`agent-browser\` or \`npx agent-browser\` in bash when \`browser*\` tools exist
- Switching chrome↔brave: \`browserClose\` first, then reopen

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| "refs stale" / click fails | \`browserSnapshot\` again after last action |
| Page blank / spinner | \`browserWait mode=load value=networkidle\` |
| Tool errors on first use | \`browserDoctor\` |
| Wrong browser used | \`browserClose\` then retry with \`browser: "chrome"\` or \`"brave"\` |
| Complex workflow | \`browserSkills skill=core\` then follow patterns |

</AGENT_BROWSER_PLUGIN>`;

/** Compact context for session compaction. */
export function buildCompactContext(status: {
  installed: boolean;
  version: string | null;
  browser: { kind: string; path: string } | null;
}): string {
  return `
## Browser Tools (opencode-agent-browser)

**Use when:** live page interaction, screenshots, login, web QA, localhost UI test, scrape rendered DOM.
**Skip when:** API/curl enough, local code only, git/file tasks.

**Flow:** browserDoctor → browserOpen → browserSnapshot → act → browserWait → browserSnapshot → browserClose
**Rules:** re-snapshot after page change; never bash agent-browser; Chrome stable or Brave only.

${status.installed ? `Ready: ${status.version}; ${status.browser?.kind} @ ${status.browser?.path}` : "Not ready — run browserDoctor"}
`.trim();
}

const BROWSER_INTENT_PATTERNS = [
  /\b(browser|website|web\s*page|webpage|web\s*app|webapp)\b/i,
  /\b(screenshot|screen\s*shot|擷圖|截圖)\b/i,
  /\b(login|log\s*in|sign\s*in|登入|登錄)\b/i,
  /\b(fill\s*(out\s*)?(the\s*)?form|submit|dropdown|按鈕|表單)\b/i,
  /\b(click|點擊|點选)\b/i,
  /\b(scrape|爬取|crawl)\b/i,
  /\b(localhost:\d+|127\.0\.0\.1:\d+)\b/i,
  /\bhttps?:\/\/\S+/i,
  /\b(ui\s*test|e2e|qa|dogfood|exploratory)\b/i,
  /\b(playwright|puppeteer|selenium|agent-browser)\b/i,
  /\b(navigate|open\s+(the\s+)?(site|page|url)|開啟|打開)\b/i,
  /\b(browserOpen|browserSnapshot|browserClick|browserFill|browserScreenshot|browserDoctor)\b/,
  /\b(前端|網頁|網站|介面).*(測試|驗證|檢查)/,
];

export function shouldInjectBrowserGuidance(text: string): boolean {
  const sample = text.slice(0, 4000);
  return BROWSER_INTENT_PATTERNS.some((pattern) => pattern.test(sample));
}

export function extractUserText(
  messages: Array<{ info: { role: string }; parts: Array<{ type: string; text?: string }> }>,
): string {
  const userMessages = messages.filter((m) => m.info.role === "user");
  const last = userMessages[userMessages.length - 1];
  if (!last) return "";
  return last.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
}