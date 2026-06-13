/**
 * Drop-in auto-init entry point.
 *
 * Usage in a static page:
 *
 *   <script type="layout-lint">
 *     nav above header 20px
 *     sidebar left-of content
 *   </script>
 *   <script type="module" src="https://esm.sh/layout-lint/auto"></script>
 *
 * On load this module finds every `<script type="layout-lint">` element,
 * concatenates their text content as the spec, creates a monitor against
 * the live DOM, and mounts the default widget. The result is exposed on
 * `window.layoutLintAuto` for callers that want to attach reporters or
 * destroy the widget later.
 */

import { createLayoutLintMonitor } from "./devtools/monitor/create-monitor.js";
import { createLayoutLintWidget } from "./devtools/widget/index.js";
import type { LayoutLintMonitorController } from "./devtools/monitor/types.js";
import type { LayoutLintWidgetController } from "./devtools/widget/types.js";

export interface LayoutLintAutoController {
  monitor: LayoutLintMonitorController;
  widget: LayoutLintWidgetController | null;
  destroy(): void;
}

const SPEC_SCRIPT_SELECTOR = 'script[type="layout-lint"]';
const AUTO_HOST_ATTR = "data-layout-lint-auto";

declare global {
  interface Window {
    layoutLintAuto?: LayoutLintAutoController;
  }
}

function dedent(raw: string): string {
  const lines = raw.split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return "";

  // Strip the longest leading-whitespace prefix shared by every non-blank
  // line. A spec authored inside an indented <script type="layout-lint">
  // block then reads flush-left in the editor instead of carrying the
  // surrounding HTML indentation on all but the first line.
  let common: string | null = null;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    if (common === null) {
      common = indent;
      continue;
    }
    let i = 0;
    const max = Math.min(common.length, indent.length);
    while (i < max && common[i] === indent[i]) i += 1;
    common = common.slice(0, i);
    if (common === "") break;
  }

  const prefix = common ?? "";
  return lines
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line.trimStart()))
    .join("\n");
}

function collectSpecText(): { text: string; hostScript: HTMLScriptElement | null } {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>(SPEC_SCRIPT_SELECTOR));
  if (scripts.length === 0) return { text: "", hostScript: null };
  const text = scripts
    .map((s) => dedent(s.textContent ?? ""))
    .filter((block) => block.length > 0)
    .join("\n");
  return { text, hostScript: scripts[0] };
}

function shouldMountWidget(hostScript: HTMLScriptElement | null): boolean {
  if (!hostScript) return true;
  return !hostScript.hasAttribute("data-no-widget");
}

function bootstrap(): LayoutLintAutoController | null {
  const { text: specText, hostScript } = collectSpecText();
  if (!specText) {
    // Nothing to do. Silent: a page may legitimately load auto.js before
    // injecting spec scripts later (rehydration, dynamic content).
    return null;
  }

  if (document.documentElement.hasAttribute(AUTO_HOST_ATTR)) {
    // Already bootstrapped on this page.
    return window.layoutLintAuto ?? null;
  }
  document.documentElement.setAttribute(AUTO_HOST_ATTR, "true");

  const monitor = createLayoutLintMonitor({ specText });

  let widget: LayoutLintWidgetController | null = null;
  if (shouldMountWidget(hostScript)) {
    const margin = 16;
    const x = Math.max(margin, window.innerWidth - 360 - margin);
    const y = Math.max(margin, window.innerHeight - 400 - margin);
    widget = createLayoutLintWidget(monitor, {
      initialPosition: { x, y },
    });
  }

  const controller: LayoutLintAutoController = {
    monitor,
    widget,
    destroy() {
      widget?.destroy();
      monitor.destroy();
      document.documentElement.removeAttribute(AUTO_HOST_ATTR);
      if (window.layoutLintAuto === controller) {
        delete window.layoutLintAuto;
      }
    },
  };

  window.layoutLintAuto = controller;
  return controller;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootstrap(), { once: true });
  } else {
    bootstrap();
  }
}

export { bootstrap };
