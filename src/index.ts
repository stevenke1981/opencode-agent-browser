import { type Plugin, tool } from "@opencode-ai/plugin";
import {
  BROWSER_CONFIG_INSTRUCTION,
  BROWSER_TOOLS_GUIDANCE,
  GUIDANCE_MARKER,
  buildCompactContext,
  extractUserText,
  shouldInjectBrowserGuidance,
} from "./opencode-agent-browser-guidance.js";
import {
  type BrowserOptions,
  checkAgentBrowser,
  runAgentBrowser,
  screenshotPath,
} from "./opencode-agent-browser-runner.js";

const browserOptionArgs = {
  browser: tool.schema
    .enum(["chrome", "brave"])
    .optional()
    .default("chrome")
    .describe("Chrome stable (default) or Brave — never Chromium/Chrome for Testing"),
  session: tool.schema
    .string()
    .optional()
    .describe("Isolated browser session name (default: default)"),
  headed: tool.schema
    .boolean()
    .optional()
    .default(false)
    .describe("Show browser window instead of headless"),
  profile: tool.schema
    .string()
    .optional()
    .describe("Chrome profile name or path to reuse login state"),
  sessionName: tool.schema
    .string()
    .optional()
    .describe("Auto-save/restore cookies and localStorage by name"),
};

function pickBrowserOptions(args: Record<string, unknown>): BrowserOptions {
  return {
    browser: args.browser as BrowserOptions["browser"],
    session: args.session as string | undefined,
    headed: args.headed as boolean | undefined,
    profile: args.profile as string | undefined,
    sessionName: args.sessionName as string | undefined,
  };
}

export const AgentBrowserPlugin: Plugin = async ({ client, directory }) => {
  const status = checkAgentBrowser();

  await client.app.log({
    body: {
      service: "opencode-agent-browser",
      level: status.installed ? "info" : "warn",
      message: status.installed
        ? `Browser tools active (${status.version ?? "agent-browser"}, ${status.browser?.kind}: ${status.browser?.path})`
        : "Browser tools loaded but agent-browser or Chrome/Brave is missing",
    },
  });

  return {
    config: async (config) => {
      config.instructions = config.instructions ?? [];
      const marker = "opencode-agent-browser";
      const hasMarker = config.instructions.some(
        (item) => typeof item === "string" && item.includes(marker),
      );
      if (!hasMarker) {
        config.instructions.push(BROWSER_CONFIG_INSTRUCTION);
      }
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      if (!output.messages.length) return;

      const userText = extractUserText(output.messages);
      if (!shouldInjectBrowserGuidance(userText)) return;

      const firstUser = output.messages.find((m) => m.info.role === "user");
      if (!firstUser?.parts.length) return;
      if (firstUser.parts.some((p) => p.type === "text" && p.text.includes(GUIDANCE_MARKER))) {
        return;
      }

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: "text",
        text: BROWSER_TOOLS_GUIDANCE,
      });
    },

    "experimental.session.compacting": async (_input, output) => {
      output.context.push(buildCompactContext(status));
    },

    tool: {
      browserDoctor: tool({
        description:
          "Check browser setup before first live-page task; call when user needs browser/website/screenshot/login/QA or browser tools fail",
        args: {},
        async execute() {
          const result = checkAgentBrowser();
          if (!result.installed) {
            return [
              "Browser automation is NOT ready.",
              result.doctor ?? "",
              "Fix:",
              "  1. npm install -g agent-browser",
              "  2. Install Google Chrome stable OR Brave browser",
              "  3. Do NOT run agent-browser install (downloads Chrome for Testing)",
            ].join("\n");
          }
          return [
            `agent-browser: ${result.version}`,
            `cli: ${result.binary}`,
            `browser: ${result.browser?.kind} (${result.browser?.path})`,
            `policy: ${result.browserPolicy}`,
            "",
            "## doctor",
            result.doctor ?? "(no output)",
          ].join("\n");
        },
      }),

      browserSkills: tool({
        description:
          "Load agent-browser skill docs (core, electron, slack, dogfood, …) — read before complex tasks",
        args: {
          skill: tool.schema
            .string()
            .optional()
            .default("core")
            .describe('Skill name: core, electron, slack, dogfood, vercel-sandbox, agentcore'),
          full: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe("Include full command reference"),
        },
        async execute(args) {
          const cmd = args.full
            ? ["skills", "get", args.skill, "--full"]
            : ["skills", "get", args.skill];
          return runAgentBrowser(cmd, { maxChars: 16_000 });
        },
      }),

      browserOpen: tool({
        description:
          "Open a URL — start here when task needs live browser (website, localhost, login, QA, screenshot). Not for API-only or local file reads",
        args: {
          url: tool.schema.string().describe("URL to navigate to"),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser(["open", args.url], pickBrowserOptions(args));
        },
      }),

      browserSnapshot: tool({
        description:
          "Get page elements as @eN refs — call before every click/fill and again after navigation or UI change (refs go stale)",
        args: {
          interactive: tool.schema
            .boolean()
            .optional()
            .default(true)
            .describe("Only interactive elements (recommended)"),
          compact: tool.schema.boolean().optional().default(false),
          depth: tool.schema.number().optional().describe("Limit tree depth"),
          selector: tool.schema.string().optional().describe("Scope to CSS selector"),
          maxChars: tool.schema.number().optional().default(20_000),
          ...browserOptionArgs,
        },
        async execute(args) {
          const flags: string[] = ["snapshot"];
          if (args.interactive) flags.push("-i");
          if (args.compact) flags.push("-c");
          if (args.depth !== undefined) flags.push("-d", String(args.depth));
          if (args.selector) flags.push("-s", args.selector);
          return runAgentBrowser(flags, {
            ...pickBrowserOptions(args),
            maxChars: args.maxChars,
          });
        },
      }),

      browserClick: tool({
        description: "Click an element by @ref or CSS selector from snapshot",
        args: {
          target: tool.schema.string().describe('Element ref (@e2) or CSS selector'),
          newTab: tool.schema.boolean().optional().default(false),
          ...browserOptionArgs,
        },
        async execute(args) {
          const flags = ["click", args.target];
          if (args.newTab) flags.push("--new-tab");
          return runAgentBrowser(flags, pickBrowserOptions(args));
        },
      }),

      browserFill: tool({
        description: "Clear an input and type text (forms, search boxes)",
        args: {
          target: tool.schema.string().describe('Element ref (@e3) or CSS selector'),
          text: tool.schema.string().describe("Text to fill"),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser(["fill", args.target, args.text], pickBrowserOptions(args));
        },
      }),

      browserType: tool({
        description: "Type text without clearing existing input",
        args: {
          target: tool.schema.string().describe('Element ref or CSS selector'),
          text: tool.schema.string().describe("Text to type"),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser(["type", args.target, args.text], pickBrowserOptions(args));
        },
      }),

      browserPress: tool({
        description: "Press a keyboard key (Enter, Tab, Control+a, Escape)",
        args: {
          key: tool.schema.string().describe('Key name, e.g. Enter, Tab, Control+a'),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser(["press", args.key], pickBrowserOptions(args));
        },
      }),

      browserGet: tool({
        description: "Get page or element info: text, html, value, attr, title, url, count",
        args: {
          what: tool.schema
            .enum(["text", "html", "value", "title", "url", "count", "attr", "box", "styles"])
            .describe("What to retrieve"),
          target: tool.schema
            .string()
            .optional()
            .describe("Element ref or selector (not needed for title/url)"),
          attribute: tool.schema
            .string()
            .optional()
            .describe('Attribute name when what is "attr"'),
          ...browserOptionArgs,
        },
        async execute(args) {
          const cmd = ["get", args.what];
          if (args.what === "attr") {
            if (!args.target || !args.attribute) {
              return 'browserGet with what="attr" requires target and attribute.';
            }
            cmd.push(args.target, args.attribute);
          } else if (args.target) {
            cmd.push(args.target);
          }
          return runAgentBrowser(cmd, pickBrowserOptions(args));
        },
      }),

      browserFind: tool({
        description:
          "Find element by semantic locator and act (role, text, label, placeholder, testid)",
        args: {
          locator: tool.schema
            .enum(["role", "text", "label", "placeholder", "alt", "title", "testid", "first", "last", "nth"])
            .describe("Locator strategy"),
          value: tool.schema.string().describe("Locator value (role name, text, selector, …)"),
          action: tool.schema
            .enum(["click", "fill", "type", "hover", "focus", "check", "uncheck"])
            .describe("Action to perform"),
          text: tool.schema
            .string()
            .optional()
            .describe("Text for fill/type actions"),
          name: tool.schema
            .string()
            .optional()
            .describe('Accessible name filter for role locator (e.g. "Submit")'),
          exact: tool.schema.boolean().optional().default(false),
          ...browserOptionArgs,
        },
        async execute(args) {
          const cmd = ["find", args.locator, args.value, args.action];
          if (args.text) cmd.push(args.text);
          if (args.name) cmd.push("--name", args.name);
          if (args.exact) cmd.push("--exact");
          return runAgentBrowser(cmd, pickBrowserOptions(args));
        },
      }),

      browserWait: tool({
        description:
          "Wait for element, text, URL pattern, or page load (prefer over blind sleep)",
        args: {
          mode: tool.schema
            .enum(["element", "ms", "text", "url", "load"])
            .default("element")
            .describe("Wait mode"),
          value: tool.schema
            .string()
            .optional()
            .describe("Ref/selector, milliseconds, text, URL glob, or load state"),
          ...browserOptionArgs,
        },
        async execute(args) {
          const cmd = ["wait"];
          switch (args.mode) {
            case "ms":
              if (!args.value) return "browserWait mode=ms requires value (milliseconds).";
              cmd.push(args.value);
              break;
            case "text":
              if (!args.value) return "browserWait mode=text requires value.";
              cmd.push("--text", args.value);
              break;
            case "url":
              if (!args.value) return "browserWait mode=url requires value (glob pattern).";
              cmd.push("--url", args.value);
              break;
            case "load":
              cmd.push("--load", args.value ?? "networkidle");
              break;
            default:
              if (!args.value) return "browserWait mode=element requires value (ref or selector).";
              cmd.push(args.value);
          }
          return runAgentBrowser(cmd, pickBrowserOptions(args));
        },
      }),

      browserScreenshot: tool({
        description: "Take a screenshot of the current page",
        args: {
          path: tool.schema
            .string()
            .optional()
            .describe("Output path (defaults to project dir)"),
          fullPage: tool.schema.boolean().optional().default(false),
          annotate: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe("Numbered labels for vision models"),
          ...browserOptionArgs,
        },
        async execute(args) {
          const out = args.path ?? screenshotPath(directory, undefined);
          const flags = ["screenshot", out];
          if (args.fullPage) flags.push("--full");
          if (args.annotate) flags.push("--annotate");
          const result = runAgentBrowser(flags, pickBrowserOptions(args));
          return `Screenshot saved: ${out}\n${result}`.trim();
        },
      }),

      browserNavigate: tool({
        description: "Browser navigation: back, forward, or reload",
        args: {
          action: tool.schema.enum(["back", "forward", "reload"]).default("back"),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser([args.action], pickBrowserOptions(args));
        },
      }),

      browserBatch: tool({
        description:
          "Run multiple agent-browser commands sequentially in one session (browser persists)",
        args: {
          commands: tool.schema
            .array(tool.schema.string())
            .describe('Commands without "agent-browser" prefix, e.g. ["open example.com", "snapshot -i"]'),
          bail: tool.schema
            .boolean()
            .optional()
            .default(true)
            .describe("Stop on first error"),
          maxChars: tool.schema.number().optional().default(20_000),
          ...browserOptionArgs,
        },
        async execute(args) {
          const flags = ["batch"];
          if (args.bail) flags.push("--bail");
          flags.push(...args.commands);
          return runAgentBrowser(flags, {
            ...pickBrowserOptions(args),
            maxChars: args.maxChars,
          });
        },
      }),

      browserRun: tool({
        description:
          "Advanced: run a raw agent-browser subcommand with args (escape hatch for unwrapped commands)",
        args: {
          command: tool.schema
            .string()
            .describe('Subcommand name, e.g. "eval", "cookies", "tab", "scroll"'),
          args: tool.schema
            .array(tool.schema.string())
            .optional()
            .default([])
            .describe("Additional arguments"),
          maxChars: tool.schema.number().optional().default(20_000),
          ...browserOptionArgs,
        },
        async execute(args) {
          return runAgentBrowser([args.command, ...args.args], {
            ...pickBrowserOptions(args),
            maxChars: args.maxChars,
          });
        },
      }),

      browserClose: tool({
        description:
          "Close browser when task done or before switching chrome/brave — always call at end of browser workflows",
        args: {
          all: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe("Close all sessions"),
          ...browserOptionArgs,
        },
        async execute(args) {
          const flags = ["close"];
          if (args.all) flags.push("--all");
          return runAgentBrowser(flags, pickBrowserOptions(args));
        },
      }),
    },
  };
};

export default AgentBrowserPlugin;