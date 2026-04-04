import type { RunLayoutLintResult } from "../../core/runtime.js";
import type { LayoutLintReporter } from "../reporter/types.js";

export interface LayoutLintMonitorOptions {
  specText: string;
  wasmUrl: string;
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
  reporters?: LayoutLintReporter[];
  autoStart?: boolean;
  observeResize?: boolean;
  observeMutations?: boolean;
  debounceMs?: number;
}

export interface LayoutLintMonitorController {
  start(): void;
  stop(): void;
  evaluateNow(): Promise<RunLayoutLintResult>;
  setSpecText(specText: string): void;
  getLatestResult(): RunLayoutLintResult | null;
  subscribe(listener: (result: RunLayoutLintResult) => void): () => void;
  pauseObserver(): void;
  resumeObserver(): void;
  destroy(): void;
}
