export * from "./core/runtime.js";
export type {
  LayoutLintDiagnostic,
  LayoutLintSecondarySpan,
  LayoutLintFix,
  LayoutLintRelatedDiagnostic,
  Rule,
  RuleResult,
} from "./core/types.js";
export { formatDiagnostic, type FormatDiagnosticOptions } from "./core/diagnostic-format.js";
export {
  DIAGNOSTIC_CATALOGUE,
  explainCode,
  type DiagnosticExplanation,
} from "./core/diagnostic-codes.js";

import { runLayoutLint, type RunLayoutLintOptions, type RunLayoutLintResult } from "./core/runtime.js";
import { formatDiagnostic, type FormatDiagnosticOptions } from "./core/diagnostic-format.js";
import { explainCode } from "./core/diagnostic-codes.js";
import type { LayoutLintDiagnostic } from "./core/types.js";

export interface CreateLayoutLintOptions {
  specText: string;
  wasmUrl?: string;
  resolve?: RunLayoutLintOptions["resolve"];
  locateFile?: RunLayoutLintOptions["locateFile"];
  dom?: RunLayoutLintOptions["dom"];
}

export interface LayoutLint {
  run(): Promise<RunLayoutLintResult>;
  getSpecText(): string;
  setSpecText(text: string): void;
  formatDiagnostics(diagnostics: LayoutLintDiagnostic[], options?: FormatDiagnosticOptions): string;
  explain(code: string): string | undefined;
}

export function createLayoutLint(options: CreateLayoutLintOptions): LayoutLint {
  if (!options || typeof options !== "object") {
    throw new TypeError("createLayoutLint requires an options object");
  }

  let specText = options.specText ?? "";

  return {
    getSpecText() {
      return specText;
    },
    setSpecText(text: string) {
      specText = text ?? "";
    },
    async run() {
      return runLayoutLint({
        specText,
        wasmUrl: options.wasmUrl,
        resolve: options.resolve,
        locateFile: options.locateFile,
        dom: options.dom,
      });
    },
    formatDiagnostics(diagnostics, formatOptions) {
      return diagnostics
        .map((d) => formatDiagnostic(d, specText, formatOptions))
        .join("\n\n");
    },
    explain(code) {
      const entry = explainCode(code);
      return entry?.explain;
    },
  };
}
