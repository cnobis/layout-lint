import { runLayoutLint, type RunLayoutLintResult } from "../../core/runtime.js";
import type { LayoutLintMonitorController, LayoutLintMonitorOptions } from "./types.js";

export function createLayoutLintMonitor(options: LayoutLintMonitorOptions): LayoutLintMonitorController {
  let specText = options.specText;
  let latestResult: RunLayoutLintResult | null = null;
  let running = false;
  let resizeHandler: ((event?: Event) => void) | null = null;
  let mutationObserver: MutationObserver | null = null;
  let debounceTimer: number | null = null;

  const listeners = new Set<(result: RunLayoutLintResult) => void>();
  const reporters = options.reporters ?? [];

  const debounceMs = options.debounceMs ?? 80;
  const observeResize = options.observeResize ?? true;
  const observeMutations = options.observeMutations ?? true;

  const isWidgetOwnedNode = (node: Node | null): boolean => {
    if (!node) return false;
    const element = node instanceof Element ? node : node.parentElement;
    if (!element) return false;
    return Boolean(element.closest("[data-layout-lint-widget='true'], [data-layout-lint-widget-overlay='true']"));
  };

  const isWidgetOwnedEventTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) return false;
    return isWidgetOwnedNode(target);
  };

  const shouldQueueForMutations = (mutations: MutationRecord[]): boolean => {
    for (const mutation of mutations) {
      if (!isWidgetOwnedNode(mutation.target)) return true;

      for (const node of mutation.addedNodes) {
        if (!isWidgetOwnedNode(node)) return true;
      }
      for (const node of mutation.removedNodes) {
        if (!isWidgetOwnedNode(node)) return true;
      }
    }
    return false;
  };

  const createMutationObserver = () =>
    new MutationObserver((mutations) => {
      if (shouldQueueForMutations(mutations)) {
        queueEvaluation();
      }
    });

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
      resizeHandler = (event?: Event) => {
        if (event?.type === "scroll" && isWidgetOwnedEventTarget(event.target)) {
          return;
        }
        queueEvaluation();
      };
      window.addEventListener("resize", resizeHandler);
      window.addEventListener("scroll", resizeHandler, true);
    }

    if (observeMutations) {
      mutationObserver = createMutationObserver();
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
    if (observeMutations && running) {
      if (!mutationObserver) {
        mutationObserver = createMutationObserver();
      }
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
    getSpecText: () => specText,
    setSpecText,
    getLatestResult: () => latestResult,
    subscribe,
    pauseObserver,
    resumeObserver,
    destroy,
  };
}
