export type WidgetCategory = "all" | "failing" | "passing";

export type EditorBackground = "#181a20" | "#2a1f2e" | "#f5f7fe" | "#f3f3ed";

export const EDITOR_BACKGROUNDS: { value: EditorBackground; label: string }[] = [
  { value: "#f5f7fe", label: "Light" },
  { value: "#f3f3ed", label: "Warm" },
  { value: "#2a1f2e", label: "Dusk" },
  { value: "#181a20", label: "Dark" },
];

export interface LayoutLintWidgetSettings {
  highlightsEnabled: boolean;
  tabsEnabled: boolean;
  constraintsPerPage: number;
  minimized: boolean;
  statusTransitionDelayEnabled: boolean;
  editorBackground: EditorBackground;
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
  wasmUrl?: string;
  locateFile?: (path: string) => string;
}

export interface LayoutLintWidgetController {
  destroy(): void;
  setVisible(visible: boolean): void;
}
