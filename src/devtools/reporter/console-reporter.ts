import type { RunLayoutLintResult } from "../../core/runtime.js";
import type { ConsoleReporterOptions, LayoutLintReporter } from "./types.js";

export function createConsoleReporter(options: ConsoleReporterOptions = {}): LayoutLintReporter {
  const prefix = options.prefix ?? "[layout-lint]";
  const dedupe = options.dedupe !== false;
  let lastSignature: string | null = null;
  return (result: RunLayoutLintResult) => {
    const total = result.results.length;
    const passed = result.results.filter((r) => r.pass).length;
    const failed = total - passed;

    if (dedupe) {
      const signature = `${total}|${passed}|` + result.results.map((r) => (r.pass ? "1" : "0")).join("");
      if (signature === lastSignature) return;
      lastSignature = signature;
    }

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
