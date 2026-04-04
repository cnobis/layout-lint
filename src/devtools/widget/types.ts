export interface LayoutLintWidgetOptions {
  title?: string;
  initialPosition?: { x: number; y: number };
}

export interface LayoutLintWidgetController {
  destroy(): void;
  setVisible(visible: boolean): void;
}
