---
description: Open a URL and capture a screenshot
agent: build
---

Capture a screenshot using plugin tools:

1. `browserDoctor` if this is the first browser task in the session
2. `browserOpen` — URL from $ARGUMENTS (required)
3. `browserWait` mode=load value=networkidle — let the page settle
4. `browserScreenshot` — save with a descriptive filename

Report the saved screenshot path. Use `browserClose` when done.