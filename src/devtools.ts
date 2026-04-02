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
  pauseObserver(): void;
  resumeObserver(): void;
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
      const negation = item.negated ? "not " : "";
      const target = item.target ? ` ${item.target}` : "";
      const target2 = item.target2 ? ` ${item.target2}` : "";
      
      // for inside relations, show semantic status without generic distance threshold text
      const isSemantic = ["inside", "partially-inside"].includes(item.relation);
      if (isSemantic) {
        console.log(
          `${status}: ${item.element} ${negation}${item.relation}${target}${target2} | ${item.pass ? "constraint met" : "constraint not met"}`,
          item
        );
      } else {
        const distance = item.distancePx == null ? "" : ` ${item.distancePx}px`;
        console.log(
          `${status}: ${item.element} ${negation}${item.relation}${target}${target2}${distance} | actual=${item.actual ?? "n/a"}`,
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

  const pauseObserver = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
  };

  const resumeObserver = () => {
    if (observeMutations && running && !mutationObserver) {
      mutationObserver = new MutationObserver(() => queueEvaluation());
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  };

  if (options.autoStart !== false) start();

  return {
    start,
    stop,
    evaluateNow,
    setSpecText,
    getLatestResult: () => latestResult,
    subscribe,
    pauseObserver,
    resumeObserver,
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
  const getRuleKey = (rule: RuleResult) => {
    // for ternary rules (target2 present), include it in the key
    if (rule.target2) {
      return `${rule.element}::${rule.relation}::${rule.target ?? ""}::${rule.target2}`;
    }
    // for binary rules, use the original key
    return `${rule.element}::${rule.relation}::${rule.target ?? ""}`;
  };

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

    const segments = text.split(" • ");
    const firstSegment = segments[0]?.trim() ?? "";
    if (segments.length > 1 && /^(\?|\d+)$/.test(firstSegment)) {
      const numberPart = document.createElement("span");
      numberPart.style.fontWeight = "700";
      numberPart.textContent = firstSegment;
      label.appendChild(numberPart);

      for (let i = 1; i < segments.length; i++) {
        const delimiter = document.createTextNode(" • ");
        label.appendChild(delimiter);

        const part = document.createElement("span");
        part.textContent = segments[i];
        label.appendChild(part);
      }
    } else {
      label.textContent = text;
    }

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
    labelText?: string
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

    if (labelText) {
      const labelX = (x1 + x2) / 2 - 90;
      const labelY = (y1 + y2) / 2 - 18;
      createOverlayLabel(labelText, color, labelX, labelY);
    }
  };

  const formatMeasurement = (value: number | string | null | undefined) => {
    if (value == null) return "n/a";
    if (typeof value === "string") return value;
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
      case "right-of":
        return {
          x1: targetRect.right,
          y1: targetCenterY,
          x2: elementRect.left,
          y2: elementCenterY,
        };
      case "left-of":
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

  const getEqualGapConnectorPoints = (
    relation: string,
    sourceRect: DOMRect,
    middleRect: DOMRect,
    endRect: DOMRect
  ) => {
    if (relation === "equal-gap-x") {
      const gapY1 = (sourceRect.top + sourceRect.bottom + middleRect.top + middleRect.bottom) / 4;
      const gapY2 = (middleRect.top + middleRect.bottom + endRect.top + endRect.bottom) / 4;
      return [
        {
          x1: sourceRect.right,
          y1: gapY1,
          x2: middleRect.left,
          y2: gapY1,
        },
        {
          x1: middleRect.right,
          y1: gapY2,
          x2: endRect.left,
          y2: gapY2,
        },
      ];
    }

    if (relation === "equal-gap-y") {
      const gapX1 = (sourceRect.left + sourceRect.right + middleRect.left + middleRect.right) / 4;
      const gapX2 = (middleRect.left + middleRect.right + endRect.left + endRect.right) / 4;
      return [
        {
          x1: gapX1,
          y1: sourceRect.bottom,
          x2: gapX1,
          y2: middleRect.top,
        },
        {
          x1: gapX2,
          y1: middleRect.bottom,
          x2: gapX2,
          y2: endRect.top,
        },
      ];
    }

    return null;
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
        createElementRoleLabel(`${rulePrefix} • ${rule.element} • source`, color, primaryRect, true);
      }

      const target = resolveElement(rule.target ?? undefined);
      const targetRect = target?.getBoundingClientRect() ?? null;
      if (target && targetRect) {
        createHighlightBox(target, color, true);
        createElementRoleLabel(`${rulePrefix} • ${rule.target} • target`, color, targetRect, true);
      }

      const target2 = resolveElement(rule.target2 ?? undefined);
      const target2Rect = target2?.getBoundingClientRect() ?? null;
      if (target2 && target2Rect) {
        createHighlightBox(target2, color, true);
        createElementRoleLabel(`${rulePrefix} • ${rule.target2} • target 2`, color, target2Rect, false);
      }

      const equalGapPoints =
        primaryRect && targetRect && target2Rect
          ? getEqualGapConnectorPoints(rule.relation, primaryRect, targetRect, target2Rect)
          : null;
      if (equalGapPoints) {
        createConnector(
          equalGapPoints[0].x1,
          equalGapPoints[0].y1,
          equalGapPoints[0].x2,
          equalGapPoints[0].y2,
          color,
          `${rulePrefix} • actual: ${formatMeasurement(rule.actual)}`
        );
        createConnector(
          equalGapPoints[1].x1,
          equalGapPoints[1].y1,
          equalGapPoints[1].x2,
          equalGapPoints[1].y2,
          color
        );
        continue;
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

  const clampWidgetIntoViewport = () => {
    const margin = 8;
    const rect = root.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const minLeft = margin;
    const minTop = margin;
    const maxLeft = Math.max(minLeft, viewportWidth - rect.width - margin);
    const maxTop = Math.max(minTop, viewportHeight - rect.height - margin);

    const currentLeft = Number.parseFloat(root.style.left || "0");
    const currentTop = Number.parseFloat(root.style.top || "0");

    const nextLeft = Math.min(Math.max(currentLeft, minLeft), maxLeft);
    const nextTop = Math.min(Math.max(currentTop, minTop), maxTop);

    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    root.style.left = `${event.clientX - offsetX}px`;
    root.style.top = `${event.clientY - offsetY}px`;
    clampWidgetIntoViewport();
  };

  const onPointerUp = () => {
    dragging = false;
    clampWidgetIntoViewport();
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
    monitor.pauseObserver();
    renderRows(latestResults);
    monitor.resumeObserver();
    renderActiveHighlight();
  };

  highlightToggle.addEventListener("pointerdown", onTogglePointerDown);
  highlightToggle.addEventListener("click", onToggleClick);
  window.addEventListener("keydown", onKeyDown);

  const onViewportChange = () => {
    clampWidgetIntoViewport();
    renderActiveHighlight();
  };

  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);
  window.requestAnimationFrame(() => {
    clampWidgetIntoViewport();
  });

  const scheduleClampWidgetIntoViewport = () => {
    window.requestAnimationFrame(() => {
      clampWidgetIntoViewport();
    });
  };

  const renderRows = (results: RuleResult[]) => {
    body.innerHTML = "";
    if (results.length === 0) {
      body.textContent = "No rules";
      status.textContent = "0/0";
      scheduleClampWidgetIntoViewport();
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

        const isSizeRule = item.relation === "width" || item.relation === "height";
        const hasPercentDistance =
          item.distancePct != null || item.distanceMinPct != null || item.distanceMaxPct != null;
        const comparatorPrefix = item.comparator ? `${item.comparator} ` : "";
        const sizeExpected = hasPercentDistance
          ? (item.distancePct != null
              ? `${item.distancePct}%`
              : `${item.distanceMinPct} to ${item.distanceMaxPct}%`)
          : (item.distancePx != null
              ? `${item.distancePx}px`
              : `${item.distanceMinPx} to ${item.distanceMaxPx}px`);

        if (isSizeRule) {
          const sizeTarget = hasPercentDistance && item.target && item.targetProperty
            ? ` of ${item.target}/${item.targetProperty}`
            : "";
          headText.textContent = `${item.pass ? "✓" : "✗"} ${item.element} ${item.negated ? "not " : ""}${item.relation} ${comparatorPrefix}${sizeExpected}${sizeTarget}`;
        } else {
          headText.textContent = `${item.pass ? "✓" : "✗"} ${item.element} ${item.negated ? "not " : ""}${item.relation}${item.target ? ` ${item.target}` : ""}${item.target2 ? ` ${item.target2}` : ""}`;
        }

        head.appendChild(numberBadge);
        head.appendChild(headText);

        const meta = document.createElement("div");
        meta.style.fontSize = "11px";
        meta.style.color = "#374151";

        const isSemantic = ["inside", "partially-inside"].includes(item.relation);
        const isAlignment =
          item.relation.startsWith("aligned-") ||
          item.relation === "centered-x" ||
          item.relation === "centered-y";
        const isEqualGap = item.relation === "equal-gap-x" || item.relation === "equal-gap-y";
        if (isSemantic) {
          const label = item.relation === "partially-inside" ? "partially inside" : "inside";
          meta.textContent = item.pass ? `${label}: constraint met` : `${label}: constraint not met`;
        } else if (isSizeRule) {
          const unit = hasPercentDistance ? "%" : "px";
          const actualText =
            typeof item.actual !== "number"
              ? "n/a"
              : `${Number(item.actual.toFixed(2))}${unit}`;

          let expectedText = "";
          if (item.comparator && (item.distancePx != null || item.distancePct != null)) {
            expectedText = `${item.comparator} ${item.distancePct ?? item.distancePx}${unit}`;
          } else if (hasPercentDistance) {
            expectedText = item.distancePct != null
              ? `${item.distancePct}%`
              : `${item.distanceMinPct} to ${item.distanceMaxPct}%`;
          } else if (item.distanceMinPx != null && item.distanceMaxPx != null) {
            expectedText = `${item.distanceMinPx} to ${item.distanceMaxPx}px`;
          } else if (item.distancePx != null) {
            expectedText = `${item.distancePx}px`;
          }

          const targetBasis = hasPercentDistance && item.target && item.targetProperty
            ? ` of ${item.target}/${item.targetProperty}`
            : "";

          meta.textContent = `actual ${item.relation}: ${actualText}${expectedText ? ` | expected: ${expectedText}${targetBasis}` : ""}`;
        } else if (isAlignment) {
          meta.textContent = `actual offset: ${item.actual ?? "n/a"} | expected: <= 1px`;
        } else if (isEqualGap) {
          const tolerance = item.distancePx ?? 1;
          meta.textContent = `actual gap delta: ${item.actual ?? "n/a"} | expected: <= ${tolerance}px`;
        } else {
          meta.textContent = `actual distance: ${item.actual ?? "n/a"}${item.distancePx != null ? ` | expected: >= ${item.distancePx}px` : ""}`;
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

        const onRowPointerDown = (event: PointerEvent) => {
          event.preventDefault();
          if (pinnedRuleKeys.has(rowKey)) {
            pinnedRuleKeys.delete(rowKey);
            activeRule = pinnedRuleKeys.size === 0 ? item : activeRule;
          } else {
            pinnedRuleKeys.add(rowKey);
            activeRule = item;
          }

          updatePinStatus();
          renderActiveHighlight();

        // defer renderRows to ensure event listener isn't disrupted
        requestAnimationFrame(() => {
          // Temporarily pause the mutation observer to avoid feedback loop
          // while rendering DOM updates
          monitor.pauseObserver();
          renderRows(latestResults);
          monitor.resumeObserver();
        });
        };

        row.addEventListener("pointerenter", onRowEnter);
        row.addEventListener("pointerleave", onRowLeave);
        row.addEventListener("pointerdown", onRowPointerDown);

        row.appendChild(head);
        row.appendChild(meta);
        body.appendChild(row);
      }

    // add evaluate button at the bottom
    const buttonContainer = document.createElement("div");
    buttonContainer.style.marginTop = "10px";
    buttonContainer.style.paddingTop = "8px";
    buttonContainer.style.borderTop = "1px solid #e5e7eb";

    const evaluateBtn = document.createElement("button");
    evaluateBtn.type = "button";
    evaluateBtn.textContent = "Evaluate";
    evaluateBtn.style.width = "100%";
    evaluateBtn.style.padding = "6px 8px";
    evaluateBtn.style.fontSize = "11px";
    evaluateBtn.style.fontWeight = "600";
    evaluateBtn.style.border = "1px solid #d1d5db";
    evaluateBtn.style.borderRadius = "6px";
    evaluateBtn.style.background = "#f3f4f6";
    evaluateBtn.style.color = "#374151";
    evaluateBtn.style.cursor = "pointer";
    evaluateBtn.style.transition = "all 120ms ease";

    evaluateBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    evaluateBtn.addEventListener("click", () => {
      void monitor.evaluateNow();
    });

    evaluateBtn.addEventListener("pointerenter", () => {
      evaluateBtn.style.background = "#e5e7eb";
      evaluateBtn.style.borderColor = "#9ca3af";
    });

    evaluateBtn.addEventListener("pointerleave", () => {
      evaluateBtn.style.background = "#f3f4f6";
      evaluateBtn.style.borderColor = "#d1d5db";
    });

    buttonContainer.appendChild(evaluateBtn);
    body.appendChild(buttonContainer);
    scheduleClampWidgetIntoViewport();
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
    clampWidgetIntoViewport();
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
      clampWidgetIntoViewport();
      renderActiveHighlight();
    },
  };
}
