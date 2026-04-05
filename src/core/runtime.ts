import { getParser } from "./parser.js";
import { extractRules } from "./dsl.js";
import { evaluateRules } from "./evaluator.js";
import type { LayoutLintDiagnostic, Rule, RuleResult } from "./types.js";

export interface RunLayoutLintOptions {
  specText: string;
  wasmUrl: string;
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
}

export interface RunLayoutLintResult {
  rules: Rule[];
  results: RuleResult[];
  diagnostics?: LayoutLintDiagnostic[];
}

export async function runLayoutLint({
  specText,
  wasmUrl,
  resolve,
  locateFile,
}: RunLayoutLintOptions): Promise<RunLayoutLintResult> {
  if (!specText) throw new Error("specText is required");
  if (!wasmUrl) throw new Error("wasmUrl is required");

  const parser = await getParser(wasmUrl, locateFile);
  const tree = parser.parse(specText);
  const { rules, diagnostics } = extractRules(tree, specText);
  const results = evaluateRules(rules, resolve);

  return { rules, results, diagnostics };
}
