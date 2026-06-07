/**
 * `<layout-lint>` custom element.
 *
 * Usage:
 *
 *   <layout-lint>
 *     nav above header 20px
 *     sidebar left-of content
 *   </layout-lint>
 *   <script type="module" src="https://esm.sh/layout-lint/web-component"></script>
 *
 * The spec can also be supplied via the `spec` attribute:
 *
 *   <layout-lint spec="nav above header 20px"></layout-lint>
 *
 * The element creates a monitor and (unless `no-widget` is present) mounts the
 * floating widget. Disconnection tears both down. Changing the `spec`
 * attribute swaps the spec text live. Spec text inside the element is read
 * once at connection; later inner-text edits are not observed (use the
 * attribute or `controller.monitor.setSpecText` for live updates).
 */

import { createLayoutLintMonitor } from "./devtools/monitor/create-monitor.js";
import { createLayoutLintWidget } from "./devtools/widget/index.js";
import type { LayoutLintMonitorController } from "./devtools/monitor/types.js";
import type { LayoutLintWidgetController } from "./devtools/widget/types.js";

const TAG = "layout-lint";

export interface LayoutLintElementController {
  monitor: LayoutLintMonitorController;
  widget: LayoutLintWidgetController | null;
}

export class LayoutLintElement extends HTMLElement {
  static observedAttributes = ["spec"];

  private controller: LayoutLintElementController | null = null;

  connectedCallback(): void {
    if (this.controller) return;
    const specText = (this.getAttribute("spec") ?? this.textContent ?? "").trim();
    if (!specText) return;

    // Hide the element itself: the widget mounts separately on document.body.
    if (!this.hasAttribute("visible")) this.style.display = "none";

    const monitor = createLayoutLintMonitor({ specText });
    const widget = this.hasAttribute("no-widget")
      ? null
      : createLayoutLintWidget(monitor, { initialPosition: { x: 16, y: 16 } });

    this.controller = { monitor, widget };
  }

  disconnectedCallback(): void {
    if (!this.controller) return;
    this.controller.widget?.destroy();
    this.controller.monitor.destroy();
    this.controller = null;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name !== "spec" || !this.controller) return;
    if (newValue == null) return;
    this.controller.monitor.setSpecText(newValue.trim());
    void this.controller.monitor.evaluateNow();
  }

  /** Returns the live monitor and widget controllers, or null before connection. */
  getController(): LayoutLintElementController | null {
    return this.controller;
  }
}

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, LayoutLintElement);
  }
}

// JSX / Vue type augmentation so consumers writing <layout-lint> in
// React, Solid, Preact, or Vue 3 templates get IntelliSense and no TS errors.
type LayoutLintIntrinsicAttributes = {
  spec?: string;
  "no-widget"?: boolean | "";
  visible?: boolean | "";
};

declare global {
  interface HTMLElementTagNameMap {
    "layout-lint": LayoutLintElement;
  }

  // React / Preact / Solid
  namespace JSX {
    interface IntrinsicElements {
      "layout-lint": LayoutLintIntrinsicAttributes & Record<string, unknown>;
    }
  }
}
