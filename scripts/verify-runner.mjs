#!/usr/bin/env node
import { checkAgentBrowser, runAgentBrowser } from "../src/opencode-agent-browser-runner.ts";

const status = checkAgentBrowser("chrome");
console.log("installed:", status.installed);
console.log("version:", status.version);
console.log("browser:", status.browser?.kind, status.browser?.path);

if (!status.installed) {
  process.exit(1);
}

const batch = runAgentBrowser(
  ["batch", "--bail", "open https://example.com", "get title", "close"],
  { maxChars: 2000, timeoutMs: 90_000 },
);
console.log("batch result:\n", batch);