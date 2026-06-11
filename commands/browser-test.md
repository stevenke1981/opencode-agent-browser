---
description: Test a web page using browser plugin tools
agent: build
---

Use browser plugin tools only (not raw agent-browser bash):

1. `browserDoctor` — verify agent-browser + Chrome stable or Brave (never Chromium)
2. `browserOpen` with the target URL (from $ARGUMENTS, or ask if missing)
3. `browserSnapshot` — get interactive elements
4. Summarize what is on the page (title, key elements, forms, links)

Do not use Playwright, Puppeteer, or raw `agent-browser` shell when browser* tools are available.