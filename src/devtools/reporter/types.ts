import type { RunLayoutLintResult } from "../../core/runtime.js";

export type LayoutLintReporter = (result: RunLayoutLintResult) => void;

export interface ConsoleReporterOptions {
  prefix?: string;
}
