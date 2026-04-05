import type { FooterStatusMode } from "./footer-status.js";

interface CreateWidgetStatusControllerArgs {
  defaultReadyActionLabel: string;
  requestRerender: () => void;
  resetDelayMs?: number;
}

export interface WidgetStatusController {
  getMode(): FooterStatusMode;
  getActionLabel(): string;
  setMode(mode: FooterStatusMode): void;
  setActionLabel(label: string): void;
  clearResetTimer(): void;
  flashDone(nextReadyActionLabel?: string): void;
  showErrorAndReset(nextReadyActionLabel?: string): void;
  destroy(): void;
}

export function createWidgetStatusController({
  defaultReadyActionLabel,
  requestRerender,
  resetDelayMs = 1600,
}: CreateWidgetStatusControllerArgs): WidgetStatusController {
  let mode: FooterStatusMode = "ready";
  let actionLabel = defaultReadyActionLabel;
  let resetTimer: number | null = null;

  const clearResetTimer = () => {
    if (resetTimer == null) return;
    window.clearTimeout(resetTimer);
    resetTimer = null;
  };

  const setMode = (nextMode: FooterStatusMode) => {
    mode = nextMode;
    requestRerender();
  };

  const setActionLabel = (label: string) => {
    actionLabel = label;
  };

  const flashDone = (nextReadyActionLabel = defaultReadyActionLabel) => {
    clearResetTimer();
    mode = "done";
    requestRerender();
    resetTimer = window.setTimeout(() => {
      mode = "ready";
      actionLabel = nextReadyActionLabel;
      requestRerender();
    }, resetDelayMs);
  };

  const showErrorAndReset = (nextReadyActionLabel = defaultReadyActionLabel) => {
    clearResetTimer();
    mode = "error";
    requestRerender();
    resetTimer = window.setTimeout(() => {
      mode = "ready";
      actionLabel = nextReadyActionLabel;
      requestRerender();
    }, resetDelayMs);
  };

  return {
    getMode: () => mode,
    getActionLabel: () => actionLabel,
    setMode,
    setActionLabel,
    clearResetTimer,
    flashDone,
    showErrorAndReset,
    destroy: clearResetTimer,
  };
}
