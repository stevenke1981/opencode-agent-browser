import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type BrowserKind = "chrome" | "brave";

export type BrowserOptions = {
  browser?: BrowserKind;
  session?: string;
  headed?: boolean;
  profile?: string;
  sessionName?: string;
  json?: boolean;
  provider?: string;
  autoConnect?: boolean;
};

export type ResolvedBrowser = {
  kind: BrowserKind;
  path: string;
};

const DEFAULT_MAX_OUTPUT = 24_000;
const BROWSER_POLICY =
  "Uses Chrome stable or Brave only — never Chromium or Chrome for Testing.";

let resolvedCommand: { bin: string; prefix: string[]; shell: boolean } | null = null;
const browserCache = new Map<BrowserKind, ResolvedBrowser>();

function isRejectedBrowserPath(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  return (
    lower.includes("chrome-for-testing") ||
    lower.includes("chromefortesting") ||
    lower.includes("chrome for testing") ||
    lower.includes("/chromium/") ||
    lower.endsWith("/chromium") ||
    lower.includes("chromium-browser") ||
    lower.includes("playwright") ||
    lower.includes("puppeteer") ||
    lower.includes("ms-playwright")
  );
}

function chromeStableCandidates(): string[] {
  const home = homedir();

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(local, "Google", "Chrome", "Application", "chrome.exe"),
    ];
  }

  if (process.platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  }

  return ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome"];
}

function braveCandidates(): string[] {
  const home = homedir();

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    return [
      join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    ];
  }

  if (process.platform === "darwin") {
    return ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"];
  }

  return ["/usr/bin/brave-browser", "/usr/bin/brave"];
}

function resolveWhich(command: string): string | null {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [command], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 10_000,
  });
  if (result.status !== 0) return null;

  const firstLine = (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine || !existsSync(firstLine) || isRejectedBrowserPath(firstLine)) {
    return null;
  }
  return firstLine;
}

function findBrowser(kind: BrowserKind): ResolvedBrowser | null {
  const candidates = kind === "chrome" ? chromeStableCandidates() : braveCandidates();

  for (const candidate of candidates) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate) && !isRejectedBrowserPath(candidate)) {
        return { kind, path: candidate };
      }
      continue;
    }

    const resolved = resolveWhich(candidate);
    if (resolved) return { kind, path: resolved };
  }

  return null;
}

export function resolveSystemBrowser(preferred: BrowserKind = "chrome"): ResolvedBrowser {
  const cached = browserCache.get(preferred);
  if (cached) return cached;

  const envOverride = process.env.OPENCODE_AGENT_BROWSER_EXECUTABLE?.trim();
  if (envOverride) {
    if (!existsSync(envOverride)) {
      throw new Error(`OPENCODE_AGENT_BROWSER_EXECUTABLE not found: ${envOverride}`);
    }
    if (isRejectedBrowserPath(envOverride)) {
      throw new Error(
        `OPENCODE_AGENT_BROWSER_EXECUTABLE rejected (Chromium/Chrome for Testing not allowed): ${envOverride}`,
      );
    }
    const kind: BrowserKind = envOverride.toLowerCase().includes("brave") ? "brave" : "chrome";
    const resolved = { kind, path: envOverride };
    browserCache.set(preferred, resolved);
    return resolved;
  }

  const searchOrder: BrowserKind[] =
    preferred === "brave" ? ["brave", "chrome"] : ["chrome", "brave"];

  for (const kind of searchOrder) {
    const found = findBrowser(kind);
    if (found) {
      browserCache.set(preferred, found);
      return found;
    }
  }

  throw new Error(
    [
      "No Chrome stable or Brave installation found.",
      "Install Google Chrome or Brave browser.",
      "Do NOT use: agent-browser install (downloads Chrome for Testing / Chromium).",
      "Optional override: set OPENCODE_AGENT_BROWSER_EXECUTABLE to a Chrome/Brave path.",
    ].join(" "),
  );
}

function windowsExeCandidates(): string[] {
  const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  return [
    join(appData, "npm", "node_modules", "agent-browser", "bin", "agent-browser-win32-x64.exe"),
    join(localAppData, "npm", "node_modules", "agent-browser", "bin", "agent-browser-win32-x64.exe"),
  ];
}

function probe(binary: string, prefix: string[] = [], shell = false): boolean {
  const full = [binary, ...prefix, "--version"];
  const result = spawnSync(full[0], full.slice(1), {
    encoding: "utf8",
    shell,
    timeout: 15_000,
  });
  return result.status === 0;
}

export function resolveAgentBrowser(): { bin: string; prefix: string[]; shell: boolean } {
  if (resolvedCommand) return resolvedCommand;

  if (process.platform === "win32") {
    for (const exe of windowsExeCandidates()) {
      if (existsSync(exe) && probe(exe)) {
        resolvedCommand = { bin: exe, prefix: [], shell: false };
        return resolvedCommand;
      }
    }
  }

  if (probe("agent-browser", [], process.platform === "win32")) {
    resolvedCommand = { bin: "agent-browser", prefix: [], shell: process.platform === "win32" };
    return resolvedCommand;
  }

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  if (probe(npx, ["agent-browser"], process.platform === "win32")) {
    resolvedCommand = { bin: npx, prefix: ["agent-browser"], shell: process.platform === "win32" };
    return resolvedCommand;
  }

  throw new Error("agent-browser CLI is not installed. Run: npm install -g agent-browser");
}

function buildGlobalFlags(options: BrowserOptions = {}): string[] {
  const flags: string[] = [];
  if (options.session) flags.push("--session", options.session);
  if (options.headed) flags.push("--headed");
  if (options.profile) flags.push("--profile", options.profile);
  if (options.sessionName) flags.push("--session-name", options.sessionName);
  if (options.json) flags.push("--json");
  if (options.provider) flags.push("-p", options.provider);
  if (options.autoConnect) flags.push("--auto-connect");

  if (!options.provider && !options.autoConnect) {
    const browser = resolveSystemBrowser(options.browser ?? "chrome");
    flags.push("--executable-path", browser.path);
  }

  return flags;
}

function truncateOutput(text: string, maxChars = DEFAULT_MAX_OUTPUT): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n...(truncated, ${trimmed.length - maxChars} chars omitted)`;
}

function formatCommand(cmd: { bin: string; prefix: string[] }, globalFlags: string[], args: string[]): string {
  return [cmd.bin, ...cmd.prefix, ...globalFlags, ...args].join(" ");
}

export function runAgentBrowser(
  args: string[],
  options: BrowserOptions & { maxChars?: number; timeoutMs?: number } = {},
): string {
  const cmd = resolveAgentBrowser();
  const { maxChars, timeoutMs = 120_000, ...browserOptions } = options;
  const globalFlags = buildGlobalFlags(browserOptions);
  const full = [cmd.bin, ...cmd.prefix, ...globalFlags, ...args];

  const result = spawnSync(full[0], full.slice(1), {
    encoding: "utf8",
    shell: cmd.shell,
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(
      `agent-browser failed (${formatCommand(cmd, globalFlags, args)}): ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`agent-browser failed (${formatCommand(cmd, globalFlags, args)}): ${detail}`);
  }

  return truncateOutput((result.stdout || result.stderr || "").trim(), maxChars);
}

export function checkAgentBrowser(browser: BrowserKind = "chrome"): {
  installed: boolean;
  binary: string | null;
  version: string | null;
  browser: ResolvedBrowser | null;
  browserPolicy: string;
  doctor: string | null;
} {
  try {
    const cmd = resolveAgentBrowser();
    const resolvedBrowser = resolveSystemBrowser(browser);
    const version = runAgentBrowser(["--version"], {
      browser,
      maxChars: 200,
      timeoutMs: 15_000,
    });
    let doctor: string | null = null;
    try {
      doctor = runAgentBrowser(["doctor"], { browser, maxChars: 4000, timeoutMs: 30_000 });
    } catch {
      doctor = "doctor command failed — verify Chrome stable or Brave is installed";
    }
    return {
      installed: true,
      binary: [cmd.bin, ...cmd.prefix].join(" "),
      version,
      browser: resolvedBrowser,
      browserPolicy: BROWSER_POLICY,
      doctor,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      installed: false,
      binary: null,
      version: null,
      browser: null,
      browserPolicy: BROWSER_POLICY,
      doctor: message,
    };
  }
}

export function screenshotPath(directory: string, filename?: string): string {
  const name = filename ?? `browser-${Date.now()}.png`;
  return join(directory, name);
}