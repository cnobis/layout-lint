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

function collectSpecText(): { text: string; hostScript: HTMLScriptElement | null } {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>(SPEC_SCRIPT_SELECTOR));
  if (scripts.length === 0) return { text: "", hostScript: null };
  const text = scripts.map((s) => s.textContent ?? "").join("\n").trim();
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
