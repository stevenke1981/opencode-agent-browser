---
description: Exploratory QA workflow for a web app
agent: build
---

Run exploratory QA on the target app using browser plugin tools.

Target URL or app: $ARGUMENTS

Workflow:
1. `browserSkills` skill=core — load workflow guidance if needed
2. `browserOpen` — navigate to the app
3. `browserSnapshot` — map interactive elements
4. Exercise key flows: navigation, forms, buttons, error states
5. After each page change: `browserSnapshot` again (refs go stale)
6. `browserScreenshot` at important states
7. `browserClose` when finished

Report: bugs found, UX issues, broken flows, console errors (via `browserRun` command=console if needed).