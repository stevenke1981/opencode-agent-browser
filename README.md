# opencode-agent-browser

Global [OpenCode](https://opencode.ai) plugin that wraps [agent-browser](https://github.com/vercel-labs/agent-browser) as typed `browser*` tools, so AI agents prefer plugin tools over raw bash, Playwright, or Puppeteer.

Built on the same pattern as [opencode-git-tools](https://github.com/stevenke1981/opencode-git-tools).

## Features

- **16 browser tools** — `browserOpen`, `browserSnapshot`, `browserClick`, `browserFill`, `browserScreenshot`, and more
- **Chrome stable / Brave only** — always passes `--executable-path`; never Chromium or Chrome for Testing
- **LLM auto-guidance** — injects when/how-to-use instructions when user messages match browser intent
- **Slash commands** — `/browser-guide`, `/browser-test`, `/browser-screenshot`, `/browser-qa`
- **Compaction-safe context** — browser workflow hints survive session compaction

## Prerequisites

### 1. agent-browser CLI

```bash
npm install -g agent-browser
```

### 2. Browser (required)

Install **one** of:

| Browser | Notes |
|---------|-------|
| **Google Chrome stable** | Default (`browser: "chrome"`) |
| **Brave** | Set `browser: "brave"` on any tool |

Do **not** run `agent-browser install` — that downloads Chrome for Testing (Chromium). This plugin always uses your system Chrome or Brave.

Optional override:

```bash
# Windows
set OPENCODE_AGENT_BROWSER_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe

# macOS / Linux
export OPENCODE_AGENT_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## Install

Clone and run the installer:

```bash
git clone https://github.com/stevenke1981/opencode-agent-browser.git
cd opencode-agent-browser
```

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**macOS / Linux:**

```bash
bash install.sh
```

The installer copies the plugin to `~/.config/opencode/plugins/` and registers it in `opencode.jsonc`.

**Restart OpenCode** after install.

## Verify

```bash
opencode run "call browserDoctor and show the result"
```

Expected output includes your Chrome or Brave executable path:

```
browser: chrome (C:\Program Files\Google\Chrome\Application\chrome.exe)
policy: Uses Chrome stable or Brave only — never Chromium or Chrome for Testing.
```

## Tools

| Tool | Purpose |
|------|---------|
| `browserDoctor` | Check install / diagnose (call before first browser task) |
| `browserSkills` | Load version-matched workflow docs |
| `browserOpen` | Navigate to URL |
| `browserSnapshot` | Accessibility tree with `@eN` refs |
| `browserClick` | Click element by ref or selector |
| `browserFill` | Clear and type into input |
| `browserType` | Type without clearing |
| `browserPress` | Press keyboard key |
| `browserGet` | Read text, url, title, value, attr |
| `browserFind` | Semantic locator (role, text, label, …) |
| `browserWait` | Wait for element, text, URL, or load |
| `browserScreenshot` | Capture page image |
| `browserNavigate` | back / forward / reload |
| `browserBatch` | Run multiple commands in one session |
| `browserRun` | Raw subcommand escape hatch |
| `browserClose` | Close browser session |

## Core workflow

```
browserDoctor → browserOpen → browserSnapshot → browserClick/browserFill
  → browserWait → browserSnapshot → browserClose
```

Re-snapshot after every page change — `@eN` refs go stale immediately.

### Example

```
browserOpen({ url: "https://example.com" })
browserWait({ mode: "load", value: "networkidle" })
browserSnapshot({ interactive: true })
browserGet({ what: "title" })
browserClose({})
```

Use Brave:

```
browserOpen({ url: "https://example.com", browser: "brave" })
```

## LLM usage guide

See **[docs/LLM_USAGE.md](docs/LLM_USAGE.md)** for full decision rules (when to use, when to skip, call examples).

The plugin uses four guidance layers:

| Layer | Mechanism |
|-------|-----------|
| 1 | `config.instructions` — short decision rules every session |
| 2 | `chat.messages.transform` — full guide when browser intent detected |
| 3 | `session.compacting` — compact workflow after context compression |
| 4 | Tool descriptions — per-tool when-to-call hints |

**Auto-detected intent keywords:** URLs, screenshot, login, localhost, QA, 截圖, 登入, 網頁測試, etc.

Force-load the guide: `/browser-guide`

## Slash commands

| Command | Description |
|---------|-------------|
| `/browser-guide [url]` | Load when/how-to-use guide for LLM |
| `/browser-test <url>` | Open and summarize a page |
| `/browser-screenshot <url>` | Capture a screenshot |
| `/browser-qa <url>` | Exploratory QA workflow |

## Project structure

```
opencode-agent-browser/
├── src/
│   ├── index.ts                          # Plugin: tools + hooks
│   ├── opencode-agent-browser-runner.ts  # CLI wrapper (Chrome/Brave)
│   └── opencode-agent-browser-guidance.ts # LLM decision guide
├── commands/                             # Slash commands
├── docs/
│   └── LLM_USAGE.md                      # LLM 使用說明
├── scripts/
│   └── install-global.mjs
├── install.ps1
└── install.sh
```

## OpenCode config

See `opencode.json.example`:

```jsonc
{
  "plugin": ["~/.config/opencode/plugins/opencode-agent-browser.ts"],
  "instructions": [
    "opencode-agent-browser: USE browser* tools for live pages. Chrome stable or Brave only."
  ]
}
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Wrong browser (Chrome for Testing) | `browserClose` then retry — plugin forces `--executable-path` |
| Refs stale / click fails | `browserSnapshot` again after last action |
| Page not loaded | `browserWait` mode=load value=networkidle |
| Switch Chrome ↔ Brave | `browserClose` first, then set `browser: "brave"` |
| First-time errors | `browserDoctor` |

## Related

- [agent-browser](https://github.com/vercel-labs/agent-browser) — underlying browser automation CLI
- [OpenCode Plugins docs](https://opencode.ai/docs/plugins/)
- [opencode-git-tools](https://github.com/stevenke1981/opencode-git-tools) — sibling plugin for Git

## License

MIT