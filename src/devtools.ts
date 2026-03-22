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
      
      // for semantic relations (contains, overlaps), don't show distance/actual
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

  const pinStatus = document.createElement("span");
  pinStatus.style.fontSize = "11px";
  pinStatus.style.opacity = "0.9";
  pinStatus.style.userSelect = "none";

  const updateToggleLabel = () => {
    highlightToggle.textContent = `highlight: ${highlightsEnabled ? "on" : "off"}`;
  };

  const pinnedRuleKeys = new Set<string>();
  const getRuleKey = (rule: RuleResult) => `${rule.element}::${rule.relation}::${rule.target ?? ""}`;

  const updatePinStatus = () => {
    pinStatus.textContent = `pin: ${pinnedRuleKeys.size}`;
  };

  updatePinStatus();
  updateToggleLabel();

  controls.appendChild(highlightToggle);
  controls.appendChild(pinStatus);
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
  let placedLabelRects: Array<{ left: number; top: number; right: number; bottom: number }> = [];

  const clearHighlights = () => {
    highlightLayer.innerHTML = "";
    placedLabelRects = [];
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

  const createOverlayLabel = (text: string, color: string, x: number, y: number) => {
    const margin = 6;
    const label = document.createElement("div");
    label.style.position = "fixed";
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.maxWidth = "280px";
    label.style.padding = "4px 7px";
    label.style.border = `1px solid ${color}`;
    label.style.borderRadius = "6px";
    label.style.background = "rgba(255,255,255,0.96)";
    label.style.color = "#111827";
    label.style.font = "11px/1.35 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.textContent = text;
    highlightLayer.appendChild(label);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const labelWidth = label.offsetWidth;
    const labelHeight = label.offsetHeight;

    const clampX = (value: number) =>
      Math.min(Math.max(margin, value), Math.max(margin, viewportWidth - labelWidth - margin));
    const clampY = (value: number) =>
      Math.min(Math.max(margin, value), Math.max(margin, viewportHeight - labelHeight - margin));

    const intersectsPlaced = (left: number, top: number) => {
      const right = left + labelWidth;
      const bottom = top + labelHeight;
      return placedLabelRects.some(
        (rect) => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top
      );
    };

    let finalX = clampX(x);
    let finalY = clampY(y);

    if (intersectsPlaced(finalX, finalY)) {
      const step = labelHeight + 6;
      let found = false;

      for (let i = 1; i <= 12; i++) {
        const downY = clampY(y + step * i);
        if (!intersectsPlaced(finalX, downY)) {
          finalY = downY;
          found = true;
          break;
        }

        const upY = clampY(y - step * i);
        if (!intersectsPlaced(finalX, upY)) {
          finalY = upY;
          found = true;
          break;
        }
      }

      if (!found) {
        for (let i = 1; i <= 8; i++) {
          const rightX = clampX(x + i * 16);
          if (!intersectsPlaced(rightX, finalY)) {
            finalX = rightX;
            found = true;
            break;
          }

          const leftX = clampX(x - i * 16);
          if (!intersectsPlaced(leftX, finalY)) {
            finalX = leftX;
            found = true;
            break;
          }
        }
      }
    }

    label.style.left = `${finalX}px`;
    label.style.top = `${finalY}px`;

    placedLabelRects.push({
      left: finalX,
      top: finalY,
      right: finalX + labelWidth,
      bottom: finalY + labelHeight,
    });

    return { width: labelWidth, height: labelHeight };
  };

  const createElementRoleLabel = (
    text: string,
    color: string,
    rect: DOMRect,
    preferAbove: boolean
  ) => {
    const gap = 8;
    const viewportHeight = window.innerHeight;

    const aboveY = rect.top - 28;
    const belowY = rect.bottom + gap;
    const hasAboveSpace = aboveY >= 6;
    const hasBelowSpace = belowY <= viewportHeight - 6;

    let y = preferAbove ? aboveY : belowY;
    if (preferAbove && !hasAboveSpace && hasBelowSpace) y = belowY;
    if (!preferAbove && !hasBelowSpace && hasAboveSpace) y = aboveY;

    createOverlayLabel(text, color, rect.left, y);
  };

  const createConnector = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    labelText: string
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const line = document.createElement("div");
    line.style.position = "fixed";
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.width = `${length}px`;
    line.style.height = "2px";
    line.style.background = color;
    line.style.transformOrigin = "0 50%";
    line.style.transform = `rotate(${Math.atan2(dy, dx) * (180 / Math.PI)}deg)`;
    highlightLayer.appendChild(line);

    const labelX = (x1 + x2) / 2 - 90;
    const labelY = (y1 + y2) / 2 - 18;
    createOverlayLabel(labelText, color, labelX, labelY);
  };

  const formatMeasurement = (value: number | null | undefined) => {
    if (value == null) return "n/a";
    return Number.isInteger(value) ? `${value}px` : `${value.toFixed(2)}px`;
  };

  const getDirectionalConnectorPoints = (
    relation: string,
    elementRect: DOMRect,
    targetRect: DOMRect
  ) => {
    const elementCenterX = elementRect.left + elementRect.width / 2;
    const elementCenterY = elementRect.top + elementRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    switch (relation) {
      case "below":
        return {
          x1: targetCenterX,
          y1: targetRect.bottom,
          x2: elementCenterX,
          y2: elementRect.top,
        };
      case "above":
        return {
          x1: targetCenterX,
          y1: targetRect.top,
          x2: elementCenterX,
          y2: elementRect.bottom,
        };
      case "right_of":
        return {
          x1: targetRect.right,
          y1: targetCenterY,
          x2: elementRect.left,
          y2: elementCenterY,
        };
      case "left_of":
        return {
          x1: elementRect.right,
          y1: elementCenterY,
          x2: targetRect.left,
          y2: targetCenterY,
        };
      default:
        return null;
    }
  };

  const renderActiveHighlight = () => {
    clearHighlights();
    if (!highlightsEnabled || root.style.display === "none") return;

    const pinnedRules = latestResults.filter((rule) => pinnedRuleKeys.has(getRuleKey(rule)));
    const rulesToRender = pinnedRules.length > 0 ? pinnedRules : (activeRule ? [activeRule] : []);
    if (rulesToRender.length === 0) return;

    const getRuleNumber = (rule: RuleResult) => {
      const byReferenceIndex = latestResults.findIndex((candidate) => candidate === rule);
      if (byReferenceIndex >= 0) return byReferenceIndex + 1;

      const byKeyIndex = latestResults.findIndex((candidate) => getRuleKey(candidate) === getRuleKey(rule));
      return byKeyIndex >= 0 ? byKeyIndex + 1 : null;
    };

    for (const rule of rulesToRender) {
      const color = rule.pass ? "#059669" : "#dc2626";
      const ruleNumber = getRuleNumber(rule);
      const rulePrefix = ruleNumber == null ? "?" : `${ruleNumber}`;

      const primary = resolveElement(rule.element);
      const primaryRect = primary?.getBoundingClientRect() ?? null;
      if (primary && primaryRect) {
        createHighlightBox(primary, color);
        createElementRoleLabel(`${rulePrefix} ${rule.element} • source`, color, primaryRect, true);
      }

      const target = resolveElement(rule.target ?? undefined);
      const targetRect = target?.getBoundingClientRect() ?? null;
      if (target && targetRect) {
        createHighlightBox(target, color, true);
        createElementRoleLabel(`${rulePrefix} ${rule.target} • target`, color, targetRect, true);
      }

      if (!primaryRect || !targetRect) continue;

      const connectorPoints = getDirectionalConnectorPoints(rule.relation, primaryRect, targetRect);
      if (!connectorPoints) continue;

      createConnector(
        connectorPoints.x1,
        connectorPoints.y1,
        connectorPoints.x2,
        connectorPoints.y2,
        color,
        `${rulePrefix} actual: ${formatMeasurement(rule.actual)}`
      );
    }
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

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (pinnedRuleKeys.size === 0) return;

    pinnedRuleKeys.clear();
    updatePinStatus();
    renderRows(latestResults);
    renderActiveHighlight();
  };

  highlightToggle.addEventListener("pointerdown", onTogglePointerDown);
  highlightToggle.addEventListener("click", onToggleClick);
  window.addEventListener("keydown", onKeyDown);

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

    for (const [index, item] of results.entries()) {
      const row = document.createElement("div");
      const rowKey = getRuleKey(item);
      const isPinned = pinnedRuleKeys.has(rowKey);
      const ruleNumber = index + 1;
      row.style.border = "1px solid #e5e7eb";
      row.style.borderRadius = "6px";
      row.style.padding = "6px 8px";
      row.style.marginBottom = "6px";
      row.style.background = item.pass ? "#ecfdf5" : "#fef2f2";
      row.style.cursor = "pointer";
      if (isPinned) {
        row.style.borderColor = "#7a81ff";
        row.style.boxShadow = "0 0 0 1px rgba(122,129,255,0.35)";
      }

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.alignItems = "center";
      head.style.gap = "6px";

      const numberBadge = document.createElement("span");
      numberBadge.style.display = "inline-flex";
      numberBadge.style.alignItems = "center";
      numberBadge.style.justifyContent = "center";
      numberBadge.style.minWidth = "26px";
      numberBadge.style.padding = "1px 7px";
      numberBadge.style.borderRadius = "999px";
      numberBadge.style.fontSize = "10px";
      numberBadge.style.fontWeight = "700";
      numberBadge.style.lineHeight = "1.3";
      numberBadge.style.border = item.pass ? "1px solid #34d399" : "1px solid #f87171";
      numberBadge.style.background = item.pass ? "#d1fae5" : "#fee2e2";
      numberBadge.style.color = item.pass ? "#065f46" : "#991b1b";
      numberBadge.textContent = `${ruleNumber}`;

      const headText = document.createElement("span");
      headText.style.fontWeight = "600";
      headText.style.color = item.pass ? "#065f46" : "#991b1b";
      headText.textContent = `${item.pass ? "✓" : "✗"} ${item.element} ${item.relation}${item.target ? ` ${item.target}` : ""}`;

      head.appendChild(numberBadge);
      head.appendChild(headText);

      const meta = document.createElement("div");
      meta.style.fontSize = "11px";
      meta.style.color = "#374151";
      
      // for semantic relations (contains, overlaps), don't show actual value
      const isSemantic = ["contains", "overlaps"].includes(item.relation);
      if (isSemantic) {
        meta.textContent = item.pass ? "constraint met" : "constraint not met";
      } else {
        meta.textContent = `actual: ${item.actual ?? "n/a"}${item.distancePx != null ? ` | expected: >= ${item.distancePx}` : ""}`;
      }

      const onRowEnter = () => {
        if (pinnedRuleKeys.size > 0) return;
        activeRule = item;
        renderActiveHighlight();
      };

      const onRowLeave = () => {
        if (pinnedRuleKeys.size > 0) return;
        activeRule = null;
        renderActiveHighlight();
      };

      const onRowClick = () => {
        if (pinnedRuleKeys.has(rowKey)) {
          pinnedRuleKeys.delete(rowKey);
          activeRule = pinnedRuleKeys.size === 0 ? item : activeRule;
        } else {
          pinnedRuleKeys.add(rowKey);
          activeRule = item;
        }

        updatePinStatus();
        renderRows(latestResults);
        renderActiveHighlight();
      };

      row.addEventListener("pointerenter", onRowEnter);
      row.addEventListener("pointerleave", onRowLeave);
      row.addEventListener("click", onRowClick);

      row.appendChild(head);
      row.appendChild(meta);
      body.appendChild(row);
    }
  };

  const unsubscribe = monitor.subscribe((result) => {
    latestResults = result.results;

    const availableKeys = new Set(latestResults.map((candidate) => getRuleKey(candidate)));
    for (const key of Array.from(pinnedRuleKeys)) {
      if (!availableKeys.has(key)) pinnedRuleKeys.delete(key);
    }

    if (activeRule) {
      const activeKey = getRuleKey(activeRule);
      activeRule = latestResults.find((candidate) => getRuleKey(candidate) === activeKey) ?? null;
    }

    updatePinStatus();

    renderRows(latestResults);
    renderActiveHighlight();
  });

  return {
    destroy: () => {
      unsubscribe();
      header.removeEventListener("pointerdown", onPointerDown);
      highlightToggle.removeEventListener("pointerdown", onTogglePointerDown);
      highlightToggle.removeEventListener("click", onToggleClick);
      window.removeEventListener("keydown", onKeyDown);
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
