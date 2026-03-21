import { runLayoutLint, type RunLayoutLintResult } from "./index.js";
import type { RuleResult } from "./evaluator.js";

export type LayoutLintReporter = (result: RunLayoutLintResult) => void;

export interface ConsoleReporterOptions {
  prefix?: string;
}

export interface LayoutLintMonitorOptions {
  specText: string;
  wasmUrl: string;
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
  reporters?: LayoutLintReporter[];
  autoStart?: boolean;
  observeResize?: boolean;
  observeMutations?: boolean;
  debounceMs?: number;
}

export interface LayoutLintWidgetOptions {
  title?: string;
  initialPosition?: { x: number; y: number };
}

export interface LayoutLintMonitorController {
  start(): void;
  stop(): void;
  evaluateNow(): Promise<RunLayoutLintResult>;
  setSpecText(specText: string): void;
  getLatestResult(): RunLayoutLintResult | null;
  subscribe(listener: (result: RunLayoutLintResult) => void): () => void;
  destroy(): void;
}

export function createConsoleReporter(options: ConsoleReporterOptions = {}): LayoutLintReporter {
  const prefix = options.prefix ?? "[layout-lint]";
  return (result: RunLayoutLintResult) => {
    const total = result.results.length;
    const passed = result.results.filter((r) => r.pass).length;
    const failed = total - passed;

    console.groupCollapsed(`${prefix} ${passed}/${total} passed (${failed} failed)`);
    for (const item of result.results) {
      const status = item.pass ? "PASS" : "FAIL";
      const target = item.target ? ` ${item.target}` : "";
      
      // For semantic relations (contains, overlaps), don't show distance/actual
      const isSemantic = ["contains", "overlaps"].includes(item.relation);
      if (isSemantic) {
        console.log(
          `${status}: ${item.element} ${item.relation}${target} | ${item.pass ? "constraint met" : "constraint not met"}`,
          item
        );
      } else {
        const distance = item.distancePx == null ? "" : ` ${item.distancePx}px`;
        console.log(
          `${status}: ${item.element} ${item.relation}${target}${distance} | actual=${item.actual ?? "n/a"}`,
          item
        );
      }
    }
    console.groupEnd();
  };
}

export function createLayoutLintMonitor(options: LayoutLintMonitorOptions): LayoutLintMonitorController {
  let specText = options.specText;
  let latestResult: RunLayoutLintResult | null = null;
  let running = false;
  let resizeHandler: (() => void) | null = null;
  let mutationObserver: MutationObserver | null = null;
  let debounceTimer: number | null = null;

  const listeners = new Set<(result: RunLayoutLintResult) => void>();
  const reporters = options.reporters ?? [];

  const debounceMs = options.debounceMs ?? 80;
  const observeResize = options.observeResize ?? true;
  const observeMutations = options.observeMutations ?? true;

  const queueEvaluation = () => {
    if (!running) return;
    if (debounceTimer != null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void evaluateNow();
    }, debounceMs);
  };

  const evaluateNow = async (): Promise<RunLayoutLintResult> => {
    const result = await runLayoutLint({
      specText,
      wasmUrl: options.wasmUrl,
      resolve: options.resolve,
      locateFile: options.locateFile,
    });

    latestResult = result;

    for (const report of reporters) report(result);
    for (const listener of listeners) listener(result);

    return result;
  };

  const start = () => {
    if (running) return;
    running = true;

    if (observeResize) {
      resizeHandler = () => queueEvaluation();
      window.addEventListener("resize", resizeHandler);
      window.addEventListener("scroll", resizeHandler, true);
    }

    if (observeMutations) {
      mutationObserver = new MutationObserver(() => queueEvaluation());
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    void evaluateNow();
  };

  const stop = () => {
    if (!running) return;
    running = false;

    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("scroll", resizeHandler, true);
      resizeHandler = null;
    }

    mutationObserver?.disconnect();
    mutationObserver = null;

    if (debounceTimer != null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const setSpecText = (nextSpecText: string) => {
    specText = nextSpecText;
    queueEvaluation();
  };

  const subscribe = (listener: (result: RunLayoutLintResult) => void) => {
    listeners.add(listener);
    if (latestResult) listener(latestResult);
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    stop();
    listeners.clear();
  };

  if (options.autoStart !== false) start();

  return {
    start,
    stop,
    evaluateNow,
    setSpecText,
    getLatestResult: () => latestResult,
    subscribe,
    destroy,
  };
}

export interface LayoutLintWidgetController {
  destroy(): void;
  setVisible(visible: boolean): void;
}

export function createLayoutLintWidget(
  monitor: LayoutLintMonitorController,
  options: LayoutLintWidgetOptions = {}
): LayoutLintWidgetController {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.zIndex = "2147483647";
  root.style.top = `${options.initialPosition?.y ?? 16}px`;
  root.style.left = `${options.initialPosition?.x ?? 16}px`;
  root.style.width = "340px";
  root.style.maxHeight = "45vh";
  root.style.overflow = "hidden";
  root.style.border = "1px solid #d1d5db";
  root.style.borderRadius = "10px";
  root.style.background = "#ffffff";
  root.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
  root.style.font = "12px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
  root.style.color = "#111827";

  const header = document.createElement("div");
  header.style.padding = "8px 10px";
  header.style.cursor = "move";
  header.style.userSelect = "none";
  header.style.background = "#7a81ff";
  header.style.color = "#ffffff";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("span");
  title.textContent = options.title ?? "layout-lint";
  header.appendChild(title);

  const status = document.createElement("span");
  status.style.fontWeight = "600";
  status.textContent = "…";

  let highlightsEnabled = true;
  const highlightToggle = document.createElement("button");
  highlightToggle.type = "button";
  highlightToggle.style.border = "1px solid rgba(255,255,255,0.6)";
  highlightToggle.style.borderRadius = "999px";
  highlightToggle.style.background = "transparent";
  highlightToggle.style.color = "#ffffff";
  highlightToggle.style.fontSize = "11px";
  highlightToggle.style.padding = "2px 8px";
  highlightToggle.style.cursor = "pointer";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.gap = "8px";

  const updateToggleLabel = () => {
    highlightToggle.textContent = `highlight: ${highlightsEnabled ? "on" : "off"}`;
  };
  updateToggleLabel();

  controls.appendChild(highlightToggle);
  controls.appendChild(status);
  header.appendChild(controls);

  const body = document.createElement("div");
  body.style.padding = "8px 10px";
  body.style.maxHeight = "calc(45vh - 40px)";
  body.style.overflow = "auto";

  root.appendChild(header);
  root.appendChild(body);
  document.body.appendChild(root);

  const highlightLayer = document.createElement("div");
  highlightLayer.style.position = "fixed";
  highlightLayer.style.inset = "0";
  highlightLayer.style.pointerEvents = "none";
  highlightLayer.style.zIndex = "2147483646";
  document.body.appendChild(highlightLayer);

  let latestResults: RuleResult[] = [];
  let activeRule: RuleResult | null = null;

  const clearHighlights = () => {
    highlightLayer.innerHTML = "";
  };

  const resolveElement = (identifier: string | undefined): HTMLElement | null => {
    if (!identifier) return null;

    const byId = document.getElementById(identifier);
    if (byId) return byId;

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return document.querySelector(`#${CSS.escape(identifier)}`);
    }

    return null;
  };

  const createHighlightBox = (element: HTMLElement, color: string, dashed = false) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return;

    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `2px ${dashed ? "dashed" : "solid"} ${color}`;
    box.style.borderRadius = "6px";
    box.style.background = `${color}22`;
    box.style.boxSizing = "border-box";
    highlightLayer.appendChild(box);
  };

  const renderActiveHighlight = () => {
    clearHighlights();
    if (!highlightsEnabled || !activeRule || root.style.display === "none") return;

    const color = activeRule.pass ? "#059669" : "#dc2626";

    const primary = resolveElement(activeRule.element);
    if (primary) createHighlightBox(primary, color);

    const target = resolveElement(activeRule.target ?? undefined);
    if (target) createHighlightBox(target, color, true);
  };

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    root.style.left = `${event.clientX - offsetX}px`;
    root.style.top = `${event.clientY - offsetY}px`;
  };

  const onPointerUp = () => {
    dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const onPointerDown = (event: PointerEvent) => {
    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest("button")) return;

    dragging = true;
    const rect = root.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  header.addEventListener("pointerdown", onPointerDown);

  const onTogglePointerDown = (event: PointerEvent) => {
    event.stopPropagation();
  };

  const onToggleClick = () => {
    highlightsEnabled = !highlightsEnabled;
    updateToggleLabel();
    renderActiveHighlight();
  };

  highlightToggle.addEventListener("pointerdown", onTogglePointerDown);
  highlightToggle.addEventListener("click", onToggleClick);

  const onViewportChange = () => {
    renderActiveHighlight();
  };

  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);

  const renderRows = (results: RuleResult[]) => {
    body.innerHTML = "";
    if (results.length === 0) {
      body.textContent = "No rules";
      status.textContent = "0/0";
      return;
    }

    const passed = results.filter((r) => r.pass).length;
    status.textContent = `${passed}/${results.length}`;

    for (const item of results) {
      const row = document.createElement("div");
      row.style.border = "1px solid #e5e7eb";
      row.style.borderRadius = "6px";
      row.style.padding = "6px 8px";
      row.style.marginBottom = "6px";
      row.style.background = item.pass ? "#ecfdf5" : "#fef2f2";

      const head = document.createElement("div");
      head.style.fontWeight = "600";
      head.style.color = item.pass ? "#065f46" : "#991b1b";
      head.textContent = `${item.pass ? "✓" : "✗"} ${item.element} ${item.relation}${item.target ? ` ${item.target}` : ""}`;

      const meta = document.createElement("div");
      meta.style.fontSize = "11px";
      meta.style.color = "#374151";
      
      // For semantic relations (contains, overlaps), don't show actual value
      const isSemantic = ["contains", "overlaps"].includes(item.relation);
      if (isSemantic) {
        meta.textContent = item.pass ? "constraint met" : "constraint not met";
      } else {
        meta.textContent = `actual: ${item.actual ?? "n/a"}${item.distancePx != null ? ` | expected: >= ${item.distancePx}` : ""}`;
      }

      const onRowEnter = () => {
        activeRule = item;
        renderActiveHighlight();
      };

      const onRowLeave = () => {
        activeRule = null;
        renderActiveHighlight();
      };

      row.addEventListener("pointerenter", onRowEnter);
      row.addEventListener("pointerleave", onRowLeave);

      row.appendChild(head);
      row.appendChild(meta);
      body.appendChild(row);
    }
  };

  const unsubscribe = monitor.subscribe((result) => {
    latestResults = result.results;

    if (activeRule) {
      activeRule = latestResults.find(
        (candidate) =>
          candidate.element === activeRule?.element &&
          candidate.relation === activeRule?.relation &&
          candidate.target === activeRule?.target
      ) ?? null;
    }

    renderRows(latestResults);
    renderActiveHighlight();
  });

  return {
    destroy: () => {
      unsubscribe();
      header.removeEventListener("pointerdown", onPointerDown);
      highlightToggle.removeEventListener("pointerdown", onTogglePointerDown);
      highlightToggle.removeEventListener("click", onToggleClick);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      clearHighlights();
      highlightLayer.remove();
      root.remove();
    },
    setVisible: (visible: boolean) => {
      root.style.display = visible ? "block" : "none";
      if (!visible) {
        clearHighlights();
        return;
      }
      renderActiveHighlight();
    },
  };
}
