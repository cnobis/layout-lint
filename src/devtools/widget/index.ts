import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { LayoutLintWidgetController, LayoutLintWidgetOptions } from "./types.js";
import type { LayoutLintDiagnostic, RuleResult } from "../../core/types.js";
import { createOverlayRenderer } from "./overlays.js";
import { createWidgetState } from "./state.js";
import { renderWidgetMinimizedStatus, renderWidgetRows } from "./rows.js";
import { createSpecEditor } from "./spec-editor.js";
import { createWidgetHeaderControls, setHeaderToggleActive } from "./header-controls.js";
import { renderWidgetSettingsPanel } from "./settings-panel.js";
import { createWidgetDragController } from "./drag-controller.js";
import { createWidgetStatusController } from "./status-controller.js";
import { createWidgetResizeController } from "./resize-controller.js";
import type { FooterDiagnosticsSummary } from "./footer-status.js";
import {
  DEFAULT_WIDGET_SETTINGS,
  DEFAULT_WIDGET_SETTINGS_STORAGE_KEY,
  MIN_WIDGET_WIDTH_PX,
  MAX_WIDGET_WIDTH_PX,
  MIN_WIDGET_HEIGHT_PX,
  MAX_WIDGET_HEIGHT_PX,
  clampConstraintsPerPage,
  loadWidgetSettings,
  normalizeWidgetSettings,
  saveWidgetSettings,
} from "../settings/index.js";

export function createLayoutLintWidget(
  monitor: LayoutLintMonitorController,
  options: LayoutLintWidgetOptions = {}
): LayoutLintWidgetController {
  const EXPANDED_WIDGET_WIDTH = 340;
  const EXPANDED_WIDGET_HEIGHT = 360;
  const MINIMIZED_WIDGET_WIDTH = 180;
  const FAKE_LOADING_DURATION_MS = 800;
  const REEVALUATE_STATUS_LABEL = "evaluating...";
  const SPEC_UPDATE_STATUS_LABEL = "parsing spec...";
  const persistSettings = options.persistSettings !== false;
  const settingsStorageKey = options.settingsStorageKey ?? DEFAULT_WIDGET_SETTINGS_STORAGE_KEY;
  const storedSettings = persistSettings
    ? loadWidgetSettings(settingsStorageKey, DEFAULT_WIDGET_SETTINGS)
    : DEFAULT_WIDGET_SETTINGS;
  const initialSettings = normalizeWidgetSettings(
    {
      tabsEnabled: options.tabsEnabled,
      constraintsPerPage: options.constraintsPerPage,
      minimized: options.initialMinimized,
      statusTransitionDelayEnabled: options.statusTransitionDelayEnabled,
      widthPx: options.widthPx,
      heightPx: options.heightPx,
    },
    storedSettings
  );

  const root = document.createElement("div");
  root.dataset.layoutLintWidget = "true";
  root.style.position = "fixed";
  root.style.zIndex = "2147483647";
  root.style.top = `${options.initialPosition?.y ?? 16}px`;
  root.style.left = `${options.initialPosition?.x ?? 16}px`;
  root.style.width = `${initialSettings.minimized ? MINIMIZED_WIDGET_WIDTH : (initialSettings.widthPx ?? EXPANDED_WIDGET_WIDTH)}px`;
  root.style.height = initialSettings.minimized ? "auto" : `${initialSettings.heightPx ?? EXPANDED_WIDGET_HEIGHT}px`;
  root.style.overflow = "hidden";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.border = "1px solid #d1d5db";
  root.style.borderRadius = "10px";
  root.style.background = "#ffffff";
  root.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
  root.style.transition = "width 140ms ease, height 140ms ease";
  root.style.font = "12px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
  root.style.color = "#111827";

  const {
    header,
    constraintsToggle,
    settingsToggle,
    specToggle,
    minimizeToggle,
  } = createWidgetHeaderControls(options.title ?? "layout-lint");

  const status = document.createElement("span");
  status.style.fontWeight = "600";
  status.textContent = "…";

  const body = document.createElement("div");
  body.style.padding = "8px 10px";
  body.style.flex = "1 1 auto";
  body.style.minHeight = "0";
  body.style.overflow = "hidden";

  root.appendChild(header);
  root.appendChild(body);
  document.body.appendChild(root);

  const highlightLayer = document.createElement("div");
  highlightLayer.dataset.layoutLintWidgetOverlay = "true";
  highlightLayer.style.position = "fixed";
  highlightLayer.style.inset = "0";
  highlightLayer.style.pointerEvents = "none";
  highlightLayer.style.zIndex = "2147483646";
  document.body.appendChild(highlightLayer);

  const overlays = createOverlayRenderer(highlightLayer);
  const state = createWidgetState({ initialSettings, defaults: DEFAULT_WIDGET_SETTINGS });
  const clearHighlights = () => overlays.clear();
  const createHighlightBox = overlays.createHighlightBox;
  const createElementRoleLabel = overlays.createElementRoleLabel;
  const createConnector = overlays.createConnector;
  const formatMeasurement = overlays.formatMeasurement;
  const getDirectionalConnectorPoints = overlays.getDirectionalConnectorPoints;
  const getEqualGapConnectorPoints = overlays.getEqualGapConnectorPoints;

  let latestResults: RuleResult[] = [];
  let latestDiagnosticsSummary: FooterDiagnosticsSummary = { total: 0, errors: 0, warnings: 0 };
  let settingsOpen = false;
  let specEditor: ReturnType<typeof createSpecEditor> | null = null;
  let requestRerender = () => {};
  const statusController = createWidgetStatusController({
    defaultReadyActionLabel: REEVALUATE_STATUS_LABEL,
    requestRerender: () => {
      requestRerender();
    },
  });

  const handleRefreshAction = async () => {
    statusController.clearResetTimer();
    statusController.setActionLabel(REEVALUATE_STATUS_LABEL);
    statusController.setMode("loading");
    try {
      if (state.getSettings().statusTransitionDelayEnabled) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, FAKE_LOADING_DURATION_MS);
        });
      }
      await monitor.evaluateNow();
      statusController.flashDone();
    } catch {
      statusController.showErrorAndReset();
    }
  };

  const applyHeaderToggleMode = (button: HTMLButtonElement, isActive: boolean) => {
    setHeaderToggleActive(button, isActive);
  };

  const updateHeaderToggleStyles = () => {
    const isSpecEditorOpen = specEditor?.isOpen() ?? false;
    const constraintsActive = !state.getSettings().minimized && !settingsOpen && !isSpecEditorOpen;
    applyHeaderToggleMode(constraintsToggle, constraintsActive);
    applyHeaderToggleMode(settingsToggle, settingsOpen);
    applyHeaderToggleMode(specToggle, isSpecEditorOpen);
    applyHeaderToggleMode(minimizeToggle, state.getSettings().minimized);
  };

  const updateMinimizeToggleLabel = () => {
    const isMinimized = state.getSettings().minimized;
    minimizeToggle.textContent = isMinimized ? "◂" : "▾";
    minimizeToggle.title = isMinimized ? "expand widget" : "minimize widget";
    minimizeToggle.setAttribute("aria-label", isMinimized ? "expand widget" : "minimize widget");
    constraintsToggle.style.display = isMinimized ? "none" : "inline-flex";
    settingsToggle.style.display = isMinimized ? "none" : "inline-flex";
    specToggle.style.display = isMinimized ? "none" : "inline-flex";
    updateHeaderToggleStyles();
  };

  const applyWidgetDimensionsForCurrentState = () => {
    const settings = state.getSettings();
    if (settings.minimized) {
      root.style.width = `${MINIMIZED_WIDGET_WIDTH}px`;
      root.style.height = "auto";
      return;
    }

    root.style.width = `${settings.widthPx ?? EXPANDED_WIDGET_WIDTH}px`;
    root.style.height = `${settings.heightPx ?? EXPANDED_WIDGET_HEIGHT}px`;
  };

  const persistCurrentSettings = () => {
    if (!persistSettings) return;
    saveWidgetSettings(settingsStorageKey, state.getSettings());
  };

  updateHeaderToggleStyles();
  updateMinimizeToggleLabel();

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
    const visibleKeys = new Set(state.getViewModel(latestResults).visibleResults.map((rule) => state.getRuleKey(rule)));
    const rulesToRender =
      pinnedRules.length > 0
        ? pinnedRules
        : activeRule && visibleKeys.has(state.getRuleKey(activeRule))
          ? [activeRule]
          : [];
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
        createElementRoleLabel(`${rulePrefix} ${rule.element} (source)`, color, primaryRect, true);
      }

      const target = resolveElement(rule.target ?? undefined);
      const targetRect = target?.getBoundingClientRect() ?? null;
      if (target && targetRect) {
        createHighlightBox(target, color, true);
        createElementRoleLabel(`${rulePrefix} ${rule.target} (target)`, color, targetRect, true);
      }

      const target2 = resolveElement(rule.target2 ?? undefined);
      const target2Rect = target2?.getBoundingClientRect() ?? null;
      if (target2 && target2Rect) {
        createHighlightBox(target2, color, true);
        createElementRoleLabel(`${rulePrefix} ${rule.target2} (target 2)`, color, target2Rect, false);
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
  const dragController = createWidgetDragController({
    root,
    header,
    onViewportChange: renderActiveHighlight,
  });
  const resizeController = createWidgetResizeController({
    root,
    getBounds: () => ({
      minWidth: MIN_WIDGET_WIDTH_PX,
      maxWidth: MAX_WIDGET_WIDTH_PX,
      minHeight: MIN_WIDGET_HEIGHT_PX,
      maxHeight: MAX_WIDGET_HEIGHT_PX,
    }),
    onResize: () => {
      renderActiveHighlight();
    },
    onResizeEnd: ({ widthPx, heightPx }) => {
      state.updateSettings({ widthPx, heightPx });
      persistCurrentSettings();
      clampWidgetIntoViewport();
      renderActiveHighlight();
    },
  });
  const clampWidgetIntoViewport = () => {
    dragController.clampIntoViewport();
  };

  const onTogglePointerDown = (event: PointerEvent) => {
    event.stopPropagation();
  };

  const resetWidgetSize = () => {
    state.updateSettings({ widthPx: undefined, heightPx: undefined });
    persistCurrentSettings();
    applyWidgetDimensionsForCurrentState();
    requestRerender();
  };

  const onHeaderDoubleClick = (event: MouseEvent) => {
    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest("button")) return;
    event.preventDefault();
    resetWidgetSize();
  };

  const onSettingsToggleClick = () => {
    if (state.getSettings().minimized) return;
    settingsOpen = true;
    specEditor?.close();
    updateHeaderToggleStyles();
    requestRerender();
  };

  const onConstraintsToggleClick = () => {
    if (state.getSettings().minimized) return;
    settingsOpen = false;
    specEditor?.close();
    updateHeaderToggleStyles();
    requestRerender();
  };

  const onSpecToggleClick = () => {
    if (state.getSettings().minimized) return;
    settingsOpen = false;
    specEditor?.open();
    updateHeaderToggleStyles();
    requestRerender();
  };

  const onMinimizeToggleClick = () => {
    const nextMinimized = !state.getSettings().minimized;
    state.updateSettings({ minimized: nextMinimized });
    if (nextMinimized && settingsOpen) {
      settingsOpen = false;
      updateHeaderToggleStyles();
    }
    if (nextMinimized && specEditor?.isOpen()) {
      specEditor.close();
    }
    persistCurrentSettings();
    updateMinimizeToggleLabel();
    resizeController.setHandlesVisible(!nextMinimized);
    resizeController.setEnabled(!nextMinimized);
    applyWidgetDimensionsForCurrentState();
    requestRerender();
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
      footerStatusMode: statusController.getMode(),
      footerStatusActionLabel: statusController.getActionLabel(),
      footerDiagnosticsSummary: latestDiagnosticsSummary,
      renderActiveHighlight,
      scheduleClampWidgetIntoViewport,
      requestRerender,
      onUnpinAll: () => {
        state.clearPinnedRules();
        requestRerender();
      },
      onRefreshRequested: handleRefreshAction,
    });
  };

  const summarizeResults = (results: RuleResult[]) => ({
    passed: results.filter((rule) => rule.pass).length,
    total: results.length,
  });

  const renderSettingsPanel = () => {
    const { passed, total } = summarizeResults(latestResults);
    renderWidgetSettingsPanel({
      body,
      status,
      settings: state.getSettings(),
      clampConstraintsPerPage,
      onUpdateSettings: (patch) => {
        state.updateSettings(patch);
        persistCurrentSettings();
        applyWidgetDimensionsForCurrentState();
        requestRerender();
      },
      onResetSize: () => {
        resetWidgetSize();
      },
      onResetDefaults: () => {
        const { widthPx, heightPx } = state.getSettings();
        state.resetSettings();
        state.updateSettings({ widthPx, heightPx });
        persistCurrentSettings();
        updateMinimizeToggleLabel();
        resizeController.setHandlesVisible(!state.getSettings().minimized);
        resizeController.setEnabled(!state.getSettings().minimized);
        applyWidgetDimensionsForCurrentState();
        requestRerender();
      },
      footerStatusMode: statusController.getMode(),
      footerStatusActionLabel: statusController.getActionLabel(),
      footerDiagnosticsSummary: latestDiagnosticsSummary,
      footerPassedCount: passed,
      footerTotalCount: total,
      scheduleClampWidgetIntoViewport,
    });
  };

  const renderBody = (results: RuleResult[]) => {
    if (state.getSettings().minimized) {
      renderWidgetMinimizedStatus(results, {
        body,
        status,
        footerStatusMode: statusController.getMode(),
        footerStatusActionLabel: statusController.getActionLabel(),
        footerDiagnosticsSummary: latestDiagnosticsSummary,
        scheduleClampWidgetIntoViewport,
      });
      return;
    }

    if (settingsOpen) {
      renderSettingsPanel();
      return;
    }
    if (specEditor?.isOpen()) {
      const { passed, total } = summarizeResults(latestResults);
      specEditor.renderPanel({
        body,
        status,
        footerStatusMode: statusController.getMode(),
        footerStatusActionLabel: statusController.getActionLabel(),
        footerDiagnosticsSummary: latestDiagnosticsSummary,
        footerPassedCount: passed,
        footerTotalCount: total,
        editorBackground: state.getSettings().editorBackground,
        scheduleClampWidgetIntoViewport,
      });
      return;
    }
    renderRows(results);
  };

  const renderBodyWithObserverPaused = (results: RuleResult[]) => {
    monitor.pauseObserver();
    try {
      renderBody(results);
      clampWidgetIntoViewport();
      renderActiveHighlight();
    } finally {
      monitor.resumeObserver();
    }
  };

  requestRerender = () => {
    renderBodyWithObserverPaused(latestResults);
  };

  const summarizeDiagnostics = (diagnostics: LayoutLintDiagnostic[] | undefined): FooterDiagnosticsSummary => {
    if (!diagnostics || diagnostics.length === 0) {
      return { total: 0, errors: 0, warnings: 0 };
    }

    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warnings = diagnostics.length - errors;
    return { total: diagnostics.length, errors, warnings };
  };

  specEditor = createSpecEditor({
    monitor,
    isStatusTransitionDelayEnabled: () => state.getSettings().statusTransitionDelayEnabled,
    fakeLoadingDurationMs: FAKE_LOADING_DURATION_MS,
    specUpdateStatusLabel: SPEC_UPDATE_STATUS_LABEL,
    clearFooterStatusResetTimer: statusController.clearResetTimer,
    setFooterStatusActionLabel: statusController.setActionLabel,
    setFooterStatusMode: statusController.setMode,
    flashFooterStatusDone: statusController.flashDone,
    showFooterErrorAndReset: statusController.showErrorAndReset,
    requestRerender,
    updateHeaderToggleStyles,
    wasmUrl: options.wasmUrl,
    locateFile: options.locateFile,
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (specEditor?.isOpen()) {
      specEditor.cancel();
      return;
    }
    if (settingsOpen) {
      settingsOpen = false;
      updateHeaderToggleStyles();
      requestRerender();
      return;
    }
    if (!state.hasPinnedRules()) return;

    state.clearPinnedRules();
    requestRerender();
  };

  settingsToggle.addEventListener("pointerdown", onTogglePointerDown);
  settingsToggle.addEventListener("click", onSettingsToggleClick);
  constraintsToggle.addEventListener("pointerdown", onTogglePointerDown);
  constraintsToggle.addEventListener("click", onConstraintsToggleClick);
  specToggle.addEventListener("pointerdown", onTogglePointerDown);
  specToggle.addEventListener("click", onSpecToggleClick);
  minimizeToggle.addEventListener("pointerdown", onTogglePointerDown);
  minimizeToggle.addEventListener("click", onMinimizeToggleClick);
  header.addEventListener("dblclick", onHeaderDoubleClick);
  window.addEventListener("keydown", onKeyDown);

  dragController.setup();
  resizeController.setup();
  resizeController.setHandlesVisible(!state.getSettings().minimized);
  resizeController.setEnabled(!state.getSettings().minimized);

  const unsubscribe = monitor.subscribe((result) => {
    latestResults = result.results;
    latestDiagnosticsSummary = summarizeDiagnostics(result.diagnostics);
    state.applyResults(latestResults);
    if (specEditor?.isOpen()) return;
    renderBodyWithObserverPaused(latestResults);
  });

  return {
    destroy: () => {
      statusController.destroy();
      unsubscribe();
      dragController.destroy();
      resizeController.destroy();
      settingsToggle.removeEventListener("pointerdown", onTogglePointerDown);
      settingsToggle.removeEventListener("click", onSettingsToggleClick);
      constraintsToggle.removeEventListener("pointerdown", onTogglePointerDown);
      constraintsToggle.removeEventListener("click", onConstraintsToggleClick);
      specToggle.removeEventListener("pointerdown", onTogglePointerDown);
      specToggle.removeEventListener("click", onSpecToggleClick);
      minimizeToggle.removeEventListener("pointerdown", onTogglePointerDown);
      minimizeToggle.removeEventListener("click", onMinimizeToggleClick);
      header.removeEventListener("dblclick", onHeaderDoubleClick);
      window.removeEventListener("keydown", onKeyDown);
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
