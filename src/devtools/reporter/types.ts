import type { RunLayoutLintResult } from "../../core/runtime.js";

export type LayoutLintReporter = (result: RunLayoutLintResult) => void;

export interface ConsoleReporterOptions {
  prefix?: string;
  /**
   * When true (default), suppress consecutive emissions whose per-rule pass/fail signature is identical.
   * Set to false to log every evaluation.
   */
  dedupe?: boolean;
}
