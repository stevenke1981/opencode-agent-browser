---
description: Load browser tool usage guide — when and how LLM should call browser* tools
agent: build
---

Read and follow the browser automation decision rules below. Use **browser* plugin tools only** (never raw `agent-browser` bash).

## Decision: should I use browser tools?

**YES** if the task needs a real browser:
- Open URLs, click, fill forms, submit
- Screenshots or visual UI verification
- Login / authenticated flows
- Web QA, E2E, localhost dev server testing
- Scrape **rendered** page content (SPA/dynamic)

**NO** if:
- API/curl/fetch is enough
- Reading local source files only
- Git, build, file edit tasks
- User did not ask for live browser interaction

## Standard workflow

1. `browserDoctor` — first browser use in session
2. `browserOpen` — navigate (url from $ARGUMENTS if provided)
3. `browserWait` mode=load value=networkidle — let page settle
4. `browserSnapshot` — get @eN refs
5. `browserClick` / `browserFill` / `browserFind` — interact
6. `browserSnapshot` again after any page change (refs go stale)
7. `browserScreenshot` — if visual proof needed
8. `browserClose` — when done

## Browser policy

- Default: Chrome stable (`browser: "chrome"`)
- Alternative: Brave (`browser: "brave"`)
- Never Chromium or Chrome for Testing

## If $ARGUMENTS provided

Treat $ARGUMENTS as the target URL or app description and execute the workflow above.

For full reference see project docs: `docs/LLM_USAGE.md`