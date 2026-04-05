import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { LayoutLintWidgetController, LayoutLintWidgetOptions } from "./types.js";
import type { RuleResult } from "../../core/types.js";
import { createOverlayRenderer } from "./overlays.js";
import { createWidgetState } from "./state.js";
import { renderWidgetRows } from "./rows.js";
import {
  DEFAULT_WIDGET_SETTINGS,
  DEFAULT_WIDGET_SETTINGS_STORAGE_KEY,
  clampConstraintsPerPage,
  loadWidgetSettings,
  normalizeWidgetSettings,
  saveWidgetSettings,
} from "../settings/index.js";

export function createLayoutLintWidget(
  monitor: LayoutLintMonitorController,
  options: LayoutLintWidgetOptions = {}
): LayoutLintWidgetController {
  const persistSettings = options.persistSettings !== false;
  const settingsStorageKey = options.settingsStorageKey ?? DEFAULT_WIDGET_SETTINGS_STORAGE_KEY;
  const storedSettings = persistSettings
    ? loadWidgetSettings(settingsStorageKey, DEFAULT_WIDGET_SETTINGS)
    : DEFAULT_WIDGET_SETTINGS;
  const initialSettings = normalizeWidgetSettings(
    {
      tabsEnabled: options.tabsEnabled,
      constraintsPerPage: options.constraintsPerPage,
    },
    storedSettings
  );

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

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.gap = "8px";

  const settingsToggle = document.createElement("button");
  settingsToggle.type = "button";
  settingsToggle.textContent = "settings";
  settingsToggle.style.border = "1px solid rgba(255,255,255,0.6)";
  settingsToggle.style.borderRadius = "999px";
  settingsToggle.style.background = "transparent";
  settingsToggle.style.color = "#ffffff";
  settingsToggle.style.fontSize = "11px";
  settingsToggle.style.padding = "2px 8px";
  settingsToggle.style.cursor = "pointer";
  settingsToggle.style.outline = "none";
  settingsToggle.style.transition = "box-shadow 120ms ease, border-color 120ms ease";
  settingsToggle.addEventListener("focus", () => {
    settingsToggle.style.borderColor = "#c7d2fe";
    settingsToggle.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.28)";
  });
  settingsToggle.addEventListener("blur", () => {
    settingsToggle.style.borderColor = "rgba(255,255,255,0.6)";
    settingsToggle.style.boxShadow = "none";
  });

  const body = document.createElement("div");
  body.style.padding = "8px 10px";
  body.style.maxHeight = "calc(45vh - 40px)";
  body.style.overflow = "auto";

  controls.appendChild(settingsToggle);
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
  const state = createWidgetState({ initialSettings, defaults: DEFAULT_WIDGET_SETTINGS });
  const clearHighlights = () => overlays.clear();
  const createHighlightBox = overlays.createHighlightBox;
  const createElementRoleLabel = overlays.createElementRoleLabel;
  const createConnector = overlays.createConnector;
  const formatMeasurement = overlays.formatMeasurement;
  const getDirectionalConnectorPoints = overlays.getDirectionalConnectorPoints;
  const getEqualGapConnectorPoints = overlays.getEqualGapConnectorPoints;

  let latestResults: RuleResult[] = [];
  let settingsOpen = false;

  const updateSettingsToggleLabel = () => {
    settingsToggle.textContent = settingsOpen ? "constraints" : "settings";
  };

  const persistCurrentSettings = () => {
    if (!persistSettings) return;
    saveWidgetSettings(settingsStorageKey, state.getSettings());
  };

  updateSettingsToggleLabel();

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

  const onSettingsToggleClick = () => {
    settingsOpen = !settingsOpen;
    updateSettingsToggleLabel();
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
      renderActiveHighlight,
      scheduleClampWidgetIntoViewport,
      requestRerender,
      onUnpinAll: () => {
        state.clearPinnedRules();
        requestRerender();
      },
    });
  };

  const renderSettingsPanel = () => {
    body.innerHTML = "";
    status.textContent = "settings";

    const section = document.createElement("div");
    section.style.display = "grid";
    section.style.gap = "10px";
    section.style.padding = "10px";
    section.style.border = "1px solid #dbe3ff";
    section.style.borderRadius = "10px";
    section.style.background = "linear-gradient(180deg, #f8faff 0%, #eef2ff 100%)";

    const settings = state.getSettings();

    const createToggleRow = (
      label: string,
      description: string,
      checked: boolean,
      onChange: (nextValue: boolean) => void
    ) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.padding = "8px 10px";
      row.style.border = "1px solid #c7d2fe";
      row.style.borderRadius = "8px";
      row.style.background = "rgba(255,255,255,0.85)";

      const textWrap = document.createElement("div");
      textWrap.style.display = "grid";
      textWrap.style.gap = "1px";

      const title = document.createElement("div");
      title.textContent = label;
      title.style.fontSize = "11px";
      title.style.fontWeight = "700";
      title.style.color = "#1f2937";

      const subtitle = document.createElement("div");
      subtitle.textContent = description;
      subtitle.style.fontSize = "10px";
      subtitle.style.color = "#6b7280";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = checked ? "On" : "Off";
      toggle.style.minWidth = "44px";
      toggle.style.padding = "3px 10px";
      toggle.style.borderRadius = "999px";
      toggle.style.border = checked ? "1px solid #6366f1" : "1px solid #9ca3af";
      toggle.style.background = checked ? "#e0e7ff" : "#f3f4f6";
      toggle.style.color = checked ? "#3730a3" : "#4b5563";
      toggle.style.fontSize = "10px";
      toggle.style.fontWeight = "700";
      toggle.style.cursor = "pointer";
      toggle.style.outline = "none";
      toggle.style.transition = "box-shadow 120ms ease";
      toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
      toggle.addEventListener("focus", () => {
        toggle.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
      });
      toggle.addEventListener("blur", () => {
        toggle.style.boxShadow = "none";
      });
      toggle.addEventListener("click", () => {
        onChange(!checked);
      });

      textWrap.appendChild(title);
      textWrap.appendChild(subtitle);
      row.appendChild(textWrap);
      row.appendChild(toggle);
      return row;
    };

    const highlightRow = createToggleRow(
      "Highlights",
      "Show overlays on linked elements",
      settings.highlightsEnabled,
      (nextValue) => {
      state.updateSettings({ highlightsEnabled: nextValue });
      persistCurrentSettings();
      requestRerender();
      }
    );

    const tabsRow = createToggleRow(
      "Tabs",
      "Split constraints into navigable pages",
      settings.tabsEnabled,
      (nextValue) => {
      state.updateSettings({ tabsEnabled: nextValue });
      persistCurrentSettings();
      requestRerender();
      }
    );

    const thresholdWrap = document.createElement("div");
    thresholdWrap.style.display = "grid";
    thresholdWrap.style.gap = "4px";
    thresholdWrap.style.padding = "8px 10px";
    const thresholdEnabled = settings.tabsEnabled;
    thresholdWrap.style.border = thresholdEnabled ? "1px solid #c7d2fe" : "1px solid #d1d5db";
    thresholdWrap.style.borderRadius = "8px";
    thresholdWrap.style.background = thresholdEnabled ? "rgba(255,255,255,0.85)" : "rgba(243,244,246,0.9)";
    thresholdWrap.style.opacity = thresholdEnabled ? "1" : "0.8";

    const thresholdLabel = document.createElement("label");
    thresholdLabel.textContent = "Constraints Per Page";
    thresholdLabel.style.fontWeight = "700";
    thresholdLabel.style.fontSize = "11px";
    thresholdLabel.style.color = "#1f2937";

    const thresholdInput = document.createElement("input");
    thresholdInput.type = "text";
    thresholdInput.inputMode = "numeric";
    thresholdInput.pattern = "[0-9]*";
    thresholdInput.maxLength = 3;
    thresholdInput.disabled = !thresholdEnabled;
    thresholdInput.value = `${settings.constraintsPerPage}`;
    thresholdInput.style.border = thresholdEnabled ? "1px solid #a5b4fc" : "1px solid #d1d5db";
    thresholdInput.style.borderRadius = "6px";
    thresholdInput.style.padding = "6px 8px";
    thresholdInput.style.fontSize = "12px";
    thresholdInput.style.background = thresholdEnabled ? "#ffffff" : "#f3f4f6";
    thresholdInput.style.color = thresholdEnabled ? "#111827" : "#6b7280";
    thresholdInput.style.outline = "none";
    thresholdInput.style.boxShadow = "none";
    thresholdInput.style.transition = "border-color 120ms ease, box-shadow 120ms ease";
    thresholdInput.addEventListener("pointerdown", (event) => event.stopPropagation());

    const commitThresholdValue = () => {
      const raw = Number.parseInt(thresholdInput.value, 10);
      const nextValue = clampConstraintsPerPage(
        Number.isFinite(raw) ? raw : settings.constraintsPerPage
      );
      thresholdInput.value = `${nextValue}`;
      state.updateSettings({ constraintsPerPage: nextValue });
      persistCurrentSettings();
      requestRerender();
    };

    thresholdInput.addEventListener("input", () => {
      const digitsOnly = thresholdInput.value.replace(/[^0-9]/g, "").slice(0, 3);
      if (digitsOnly !== thresholdInput.value) {
        thresholdInput.value = digitsOnly;
      }
    });

    thresholdInput.addEventListener("blur", commitThresholdValue);
    thresholdInput.addEventListener("focus", () => {
      thresholdInput.style.borderColor = "#6366f1";
      thresholdInput.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
    });
    thresholdInput.addEventListener("blur", () => {
      thresholdInput.style.borderColor = "#a5b4fc";
      thresholdInput.style.boxShadow = "none";
    });
    thresholdInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      commitThresholdValue();
    });

    const helper = document.createElement("div");
    helper.style.fontSize = "10px";
    helper.style.color = "#6b7280";
    helper.textContent = "Allowed range: 5 to 200.";

    thresholdWrap.appendChild(thresholdLabel);
    thresholdWrap.appendChild(thresholdInput);
    thresholdWrap.appendChild(helper);

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Reset Defaults";
    resetButton.style.padding = "6px 8px";
    resetButton.style.fontSize = "11px";
    resetButton.style.fontWeight = "600";
    resetButton.style.border = "1px solid #d1d5db";
    resetButton.style.borderRadius = "6px";
    resetButton.style.background = "#f3f4f6";
    resetButton.style.color = "#374151";
    resetButton.style.cursor = "pointer";
    resetButton.style.transition = "all 120ms ease";
    resetButton.style.outline = "none";
    resetButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    resetButton.addEventListener("click", () => {
      state.resetSettings();
      persistCurrentSettings();
      requestRerender();
    });
    resetButton.addEventListener("focus", () => {
      resetButton.style.borderColor = "#6366f1";
      resetButton.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
    });
    resetButton.addEventListener("blur", () => {
      resetButton.style.borderColor = "#d1d5db";
      resetButton.style.boxShadow = "none";
    });
    resetButton.addEventListener("pointerenter", () => {
      resetButton.style.background = "#e5e7eb";
      resetButton.style.borderColor = "#9ca3af";
    });
    resetButton.addEventListener("pointerleave", () => {
      resetButton.style.background = "#f3f4f6";
      resetButton.style.borderColor = "#d1d5db";
    });

    section.appendChild(highlightRow);
    section.appendChild(tabsRow);
    section.appendChild(thresholdWrap);
    section.appendChild(resetButton);
    body.appendChild(section);
    scheduleClampWidgetIntoViewport();
  };

  const renderBody = (results: RuleResult[]) => {
    if (settingsOpen) {
      renderSettingsPanel();
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

  const requestRerender = () => {
    renderBodyWithObserverPaused(latestResults);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (settingsOpen) {
      settingsOpen = false;
      updateSettingsToggleLabel();
      requestRerender();
      return;
    }
    if (!state.hasPinnedRules()) return;

    state.clearPinnedRules();
    requestRerender();
  };

  settingsToggle.addEventListener("pointerdown", onTogglePointerDown);
  settingsToggle.addEventListener("click", onSettingsToggleClick);
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
    renderBodyWithObserverPaused(latestResults);
  });

  return {
    destroy: () => {
      unsubscribe();
      header.removeEventListener("pointerdown", onPointerDown);
      settingsToggle.removeEventListener("pointerdown", onTogglePointerDown);
      settingsToggle.removeEventListener("click", onSettingsToggleClick);
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
