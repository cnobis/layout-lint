import type { LayoutLintWidgetSettings } from "../widget/types.js";

export const DEFAULT_WIDGET_SETTINGS: LayoutLintWidgetSettings = {
  highlightsEnabled: true,
  tabsEnabled: true,
  constraintsPerPage: 10,
  minimized: false,
  statusTransitionDelayEnabled: true,
};

export const DEFAULT_WIDGET_SETTINGS_STORAGE_KEY = "layout-lint:widget-settings";

const MIN_CONSTRAINTS_PER_PAGE = 5;
const MAX_CONSTRAINTS_PER_PAGE = 200;
export const MIN_WIDGET_WIDTH_PX = 320;
export const MAX_WIDGET_WIDTH_PX = 960;
export const MIN_WIDGET_HEIGHT_PX = 220;
export const MAX_WIDGET_HEIGHT_PX = 960;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const clampConstraintsPerPage = (value: number): number => {
  return Math.min(Math.max(Math.round(value), MIN_CONSTRAINTS_PER_PAGE), MAX_CONSTRAINTS_PER_PAGE);
};

const clampWidgetWidthPx = (value: number): number => {
  return Math.min(Math.max(Math.round(value), MIN_WIDGET_WIDTH_PX), MAX_WIDGET_WIDTH_PX);
};

const clampWidgetHeightPx = (value: number): number => {
  return Math.min(Math.max(Math.round(value), MIN_WIDGET_HEIGHT_PX), MAX_WIDGET_HEIGHT_PX);
};

export const normalizeWidgetSettings = (
  partial: Partial<LayoutLintWidgetSettings> | undefined,
  fallback: LayoutLintWidgetSettings = DEFAULT_WIDGET_SETTINGS
): LayoutLintWidgetSettings => {
  const highlightsEnabled =
    typeof partial?.highlightsEnabled === "boolean" ? partial.highlightsEnabled : fallback.highlightsEnabled;
  const tabsEnabled = typeof partial?.tabsEnabled === "boolean" ? partial.tabsEnabled : fallback.tabsEnabled;
  const minimized = typeof partial?.minimized === "boolean" ? partial.minimized : fallback.minimized;
  const statusTransitionDelayEnabled =
    typeof partial?.statusTransitionDelayEnabled === "boolean"
      ? partial.statusTransitionDelayEnabled
      : fallback.statusTransitionDelayEnabled;
  const widthValue = toFiniteNumber(partial?.widthPx);
  const heightValue = toFiniteNumber(partial?.heightPx);
  const constraintsValue = toFiniteNumber(partial?.constraintsPerPage);
  const constraintsPerPage = clampConstraintsPerPage(constraintsValue ?? fallback.constraintsPerPage);

  return {
    highlightsEnabled,
    tabsEnabled,
    constraintsPerPage,
    minimized,
    statusTransitionDelayEnabled,
    widthPx: widthValue != null ? clampWidgetWidthPx(widthValue) : fallback.widthPx,
    heightPx: heightValue != null ? clampWidgetHeightPx(heightValue) : fallback.heightPx,
  };
};

export const loadWidgetSettings = (
  storageKey: string,
  fallback: LayoutLintWidgetSettings = DEFAULT_WIDGET_SETTINGS
): LayoutLintWidgetSettings => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<LayoutLintWidgetSettings>;
    return normalizeWidgetSettings(parsed, fallback);
  } catch {
    return fallback;
  }
};

export const saveWidgetSettings = (storageKey: string, settings: LayoutLintWidgetSettings): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // ignore persistence failures in restricted browser contexts
  }
};
