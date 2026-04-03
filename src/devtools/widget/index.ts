import type { LayoutLintMonitorController, LayoutLintWidgetController, LayoutLintWidgetOptions } from "../index.js";
import type { RuleResult } from "../../core/types.js";
import { createOverlayRenderer } from "./overlays.js";
import { createWidgetState } from "./state.js";
import { renderWidgetRows } from "./rows.js";

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

  const body = document.createElement("div");
  body.style.padding = "8px 10px";
  body.style.maxHeight = "calc(45vh - 40px)";
  body.style.overflow = "auto";

  controls.appendChild(highlightToggle);
  controls.appendChild(pinStatus);
  controls.appendChild(status);
  header.appendChild(controls);

  root.appendChild(header);
  root.appendChild(body);
  document.body.appendChild(root);

  const highlightLayer = document.createElement("div");
  highlightLayer.style.position = "fixed";
  highlightLayer.style.inset = "0";
  highlightLayer.style.pointerEvents = "none";
  highlightLayer.style.zIndex = "2147483646";
  document.body.appendChild(highlightLayer);

  const overlays = createOverlayRenderer(highlightLayer);
  const state = createWidgetState();
  const clearHighlights = () => overlays.clear();
  const createHighlightBox = overlays.createHighlightBox;
  const createElementRoleLabel = overlays.createElementRoleLabel;
  const createConnector = overlays.createConnector;
  const formatMeasurement = overlays.formatMeasurement;
  const getDirectionalConnectorPoints = overlays.getDirectionalConnectorPoints;
  const getEqualGapConnectorPoints = overlays.getEqualGapConnectorPoints;

  let latestResults: RuleResult[] = [];

  const updateToggleLabel = () => {
    highlightToggle.textContent = `highlight: ${state.isHighlightsEnabled() ? "on" : "off"}`;
  };

  const updatePinStatus = () => {
    pinStatus.textContent = `pin: ${state.getPinnedRuleCount()}`;
  };

  updateToggleLabel();
  updatePinStatus();

  const resolveElement = (identifier: string | undefined): HTMLElement | null => {
    if (!identifier) return null;

    const byId = document.getElementById(identifier);
    if (byId) return byId;

    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return document.querySelector(`#${CSS.escape(identifier)}`);
    }

    return null;
  };

  const renderActiveHighlight = () => {
    clearHighlights();
    if (!state.isHighlightsEnabled() || root.style.display === "none") return;

    const pinnedRules = state.getPinnedRules(latestResults);
    const activeRule = state.getActiveRule();
    const rulesToRender = pinnedRules.length > 0 ? pinnedRules : (activeRule ? [activeRule] : []);
    if (rulesToRender.length === 0) return;

    const getRuleNumber = (rule: RuleResult) => {
      const byReferenceIndex = latestResults.findIndex((candidate) => candidate === rule);
      if (byReferenceIndex >= 0) return byReferenceIndex + 1;

      const byKeyIndex = latestResults.findIndex((candidate) => state.getRuleKey(candidate) === state.getRuleKey(rule));
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
        createConnector(equalGapPoints[1].x1, equalGapPoints[1].y1, equalGapPoints[1].x2, equalGapPoints[1].y2, color);
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
    state.toggleHighlights();
    updateToggleLabel();
    renderActiveHighlight();
  };

  const scheduleClampWidgetIntoViewport = () => {
    window.requestAnimationFrame(() => {
      clampWidgetIntoViewport();
    });
  };

  const renderRows = (results: RuleResult[]) => {
    renderWidgetRows(results, {
      body,
      status,
      state,
      monitor,
      renderActiveHighlight,
      clampWidgetIntoViewport,
      scheduleClampWidgetIntoViewport,
      updatePinStatus,
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (!state.hasPinnedRules()) return;

    state.clearPinnedRules();
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

  const unsubscribe = monitor.subscribe((result) => {
    latestResults = result.results;
    state.applyResults(latestResults);
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
