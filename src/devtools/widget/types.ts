export type WidgetCategory = "all" | "failing" | "passing";

export interface LayoutLintWidgetSettings {
  highlightsEnabled: boolean;
  tabsEnabled: boolean;
  constraintsPerPage: number;
  minimized: boolean;
  statusTransitionDelayEnabled: boolean;
  widthPx?: number;
  heightPx?: number;
}

export interface LayoutLintWidgetOptions {
  title?: string;
  initialPosition?: { x: number; y: number };
  tabsEnabled?: boolean;
  constraintsPerPage?: number;
  initialMinimized?: boolean;
  statusTransitionDelayEnabled?: boolean;
  widthPx?: number;
  heightPx?: number;
  persistSettings?: boolean;
  settingsStorageKey?: string;
}

export interface LayoutLintWidgetController {
  destroy(): void;
  setVisible(visible: boolean): void;
}
