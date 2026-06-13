import type { RunLayoutLintResult } from "../../core/runtime.js";
import type { LayoutLintReporter } from "../reporter/types.js";

export interface LayoutLintMonitorOptions {
  specText: string;
  wasmUrl?: string;
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
  reporters?: LayoutLintReporter[];
  autoStart?: boolean;
  observeResize?: boolean;
  observeMutations?: boolean;
  /**
   * Minimum interval (ms) between observer-driven evaluations. Evaluations are
   * coalesced onto animation frames and throttled to at most one per interval,
   * so high-frequency mutation sources (animations, live data) can't saturate
   * the main thread. Defaults to 80.
   */
  debounceMs?: number;
}

export interface LayoutLintMonitorController {
  start(): void;
  stop(): void;
  evaluateNow(): Promise<RunLayoutLintResult>;
  getSpecText(): string;
  setSpecText(specText: string): void;
  getLatestResult(): RunLayoutLintResult | null;
  subscribe(listener: (result: RunLayoutLintResult) => void): () => void;
  pauseObserver(): void;
  resumeObserver(): void;
  destroy(): void;
}
