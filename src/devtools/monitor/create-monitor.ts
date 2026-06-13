import {
  parseSpec,
  evaluateParsedSpec,
  type ParsedSpec,
  type RunLayoutLintResult,
} from "../../core/runtime.js";
import type { LayoutLintMonitorController, LayoutLintMonitorOptions } from "./types.js";

export function createLayoutLintMonitor(options: LayoutLintMonitorOptions): LayoutLintMonitorController {
  let specText = options.specText;
  let parsedSpec: ParsedSpec | null = null;
  let latestResult: RunLayoutLintResult | null = null;
  let running = false;
  let resizeHandler: ((event?: Event) => void) | null = null;
  let mutationObserver: MutationObserver | null = null;

  // Throttle scheduler state (see queueEvaluation).
  let frameScheduled = false;
  let trailingTimer: number | null = null;
  let lastRunAt = 0;

  const listeners = new Set<(result: RunLayoutLintResult) => void>();
  const reporters = options.reporters ?? [];

  // Minimum gap between observer-driven evaluations. Bursts within this window
  // are coalesced into a single trailing run, so high-frequency mutation
  // sources (animations, live data) can't saturate the main thread.
  const minIntervalMs = options.debounceMs ?? 80;
  const observeResize = options.observeResize ?? true;
  const observeMutations = options.observeMutations ?? true;

  const now = (): number =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

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

  const runScheduledEvaluation = () => {
    frameScheduled = false;
    if (!running) return;
    lastRunAt = now();
    void evaluateNow();
  };

  // Coalesce a burst of mutations into a single evaluation on the next animation
  // frame (so geometry is read after the browser has laid out the frame), and
  // never run more often than minIntervalMs. A sustained mutation stream is
  // therefore bounded to roughly one evaluation per interval with a trailing run
  // to capture the final state.
  const requestFrame = () => {
    if (frameScheduled) return;
    frameScheduled = true;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(runScheduledEvaluation);
    } else {
      window.setTimeout(runScheduledEvaluation, 16);
    }
  };

  const queueEvaluation = () => {
    if (!running) return;
    const elapsed = now() - lastRunAt;
    if (elapsed >= minIntervalMs) {
      requestFrame();
    } else if (trailingTimer == null) {
      trailingTimer = window.setTimeout(() => {
        trailingTimer = null;
        requestFrame();
      }, minIntervalMs - elapsed);
    }
  };

  const ensureParsed = async (): Promise<ParsedSpec> => {
    if (!parsedSpec) {
      parsedSpec = await parseSpec({
        specText,
        wasmUrl: options.wasmUrl,
        locateFile: options.locateFile,
      });
    }
    return parsedSpec;
  };

  const evaluateNow = async (): Promise<RunLayoutLintResult> => {
    // Parse once per spec change; subsequent evaluations only re-measure the DOM.
    const parsed = await ensureParsed();
    const result = evaluateParsedSpec(parsed, { resolve: options.resolve });

    latestResult = result;
    lastRunAt = now();

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

    if (trailingTimer != null) {
      window.clearTimeout(trailingTimer);
      trailingTimer = null;
    }
    frameScheduled = false;
  };

  const setSpecText = (nextSpecText: string) => {
    specText = nextSpecText;
    // Spec changed: drop the cached parse so the next evaluation re-parses.
    parsedSpec = null;
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
