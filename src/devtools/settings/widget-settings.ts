import type { LayoutLintWidgetSettings } from "../widget/types.js";

export const DEFAULT_WIDGET_SETTINGS: LayoutLintWidgetSettings = {
  highlightsEnabled: true,
  tabsEnabled: true,
  constraintsPerPage: 10,
};

export const DEFAULT_WIDGET_SETTINGS_STORAGE_KEY = "layout-lint:widget-settings";

const MIN_CONSTRAINTS_PER_PAGE = 5;
const MAX_CONSTRAINTS_PER_PAGE = 200;

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

export const normalizeWidgetSettings = (
  partial: Partial<LayoutLintWidgetSettings> | undefined,
  fallback: LayoutLintWidgetSettings = DEFAULT_WIDGET_SETTINGS
): LayoutLintWidgetSettings => {
  const highlightsEnabled =
    typeof partial?.highlightsEnabled === "boolean" ? partial.highlightsEnabled : fallback.highlightsEnabled;
  const tabsEnabled = typeof partial?.tabsEnabled === "boolean" ? partial.tabsEnabled : fallback.tabsEnabled;
  const constraintsValue = toFiniteNumber(partial?.constraintsPerPage);
  const constraintsPerPage = clampConstraintsPerPage(constraintsValue ?? fallback.constraintsPerPage);

  return {
    highlightsEnabled,
    tabsEnabled,
    constraintsPerPage,
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
