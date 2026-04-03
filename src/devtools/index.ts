import { runLayoutLint, type RunLayoutLintResult } from "../index.js";
import type { RuleResult } from "../core/types.js";
export { createLayoutLintWidget } from "./widget/index.js";

export type LayoutLintReporter = (result: RunLayoutLintResult) => void;

export interface ConsoleReporterOptions {
  prefix?: string;
}

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

export interface LayoutLintWidgetOptions {
  title?: string;
  initialPosition?: { x: number; y: number };
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

export function createConsoleReporter(options: ConsoleReporterOptions = {}): LayoutLintReporter {
  const prefix = options.prefix ?? "[layout-lint]";
  return (result: RunLayoutLintResult) => {
    const total = result.results.length;
    const passed = result.results.filter((r) => r.pass).length;
    const failed = total - passed;

    console.groupCollapsed(`${prefix} ${passed}/${total} passed (${failed} failed)`);
    for (const item of result.results) {
      const status = item.pass ? "PASS" : "FAIL";
      const negation = item.negated ? "not " : "";
      const target = item.target ? ` ${item.target}` : "";
      const target2 = item.target2 ? ` ${item.target2}` : "";

      const isSemantic = ["inside", "partially-inside"].includes(item.relation);
      if (isSemantic) {
        console.log(
          `${status}: ${item.element} ${negation}${item.relation}${target}${target2} | ${item.pass ? "constraint met" : "constraint not met"}`,
          item
        );
      } else {
        const distance = item.distancePx == null ? "" : ` ${item.distancePx}px`;
        console.log(
          `${status}: ${item.element} ${negation}${item.relation}${target}${target2}${distance} | actual=${item.actual ?? "n/a"}`,
          item
        );
      }
    }
    console.groupEnd();
  };
}

export function createLayoutLintMonitor(options: LayoutLintMonitorOptions): LayoutLintMonitorController {
  let specText = options.specText;
  let latestResult: RunLayoutLintResult | null = null;
  let running = false;
  let resizeHandler: (() => void) | null = null;
  let mutationObserver: MutationObserver | null = null;
  let debounceTimer: number | null = null;

  const listeners = new Set<(result: RunLayoutLintResult) => void>();
  const reporters = options.reporters ?? [];

  const debounceMs = options.debounceMs ?? 80;
  const observeResize = options.observeResize ?? true;
  const observeMutations = options.observeMutations ?? true;

  const queueEvaluation = () => {
    if (!running) return;
    if (debounceTimer != null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void evaluateNow();
    }, debounceMs);
  };

  const evaluateNow = async (): Promise<RunLayoutLintResult> => {
    const result = await runLayoutLint({
      specText,
      wasmUrl: options.wasmUrl,
      resolve: options.resolve,
      locateFile: options.locateFile,
    });

    latestResult = result;

    for (const report of reporters) report(result);
    for (const listener of listeners) listener(result);

    return result;
  };

  const start = () => {
    if (running) return;
    running = true;

    if (observeResize) {
      resizeHandler = () => queueEvaluation();
      window.addEventListener("resize", resizeHandler);
      window.addEventListener("scroll", resizeHandler, true);
    }

    if (observeMutations) {
      mutationObserver = new MutationObserver(() => queueEvaluation());
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    void evaluateNow();
  };

  const stop = () => {
    if (!running) return;
    running = false;

    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("scroll", resizeHandler, true);
      resizeHandler = null;
    }

    mutationObserver?.disconnect();
    mutationObserver = null;

    if (debounceTimer != null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const setSpecText = (nextSpecText: string) => {
    specText = nextSpecText;
    queueEvaluation();
  };

  const subscribe = (listener: (result: RunLayoutLintResult) => void) => {
    listeners.add(listener);
    if (latestResult) listener(latestResult);
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    stop();
    listeners.clear();
  };

  const pauseObserver = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
  };

  const resumeObserver = () => {
    if (observeMutations && running && !mutationObserver) {
      mutationObserver = new MutationObserver(() => queueEvaluation());
      mutationObserver.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  };

  if (options.autoStart !== false) start();

  return {
    start,
    stop,
    evaluateNow,
    setSpecText,
    getLatestResult: () => latestResult,
    subscribe,
    pauseObserver,
    resumeObserver,
    destroy,
  };
}

export interface LayoutLintWidgetController {
  destroy(): void;
  setVisible(visible: boolean): void;
}
