import { getParser } from "./parser.js";
import { extractRules, Rule } from "./dsl.js";
import { evaluateRules, RuleResult } from "./evaluator.js";


export interface RunLayoutLintOptions {
  specText: string;
  wasmUrl: string;               // path to layout_lint.wasm
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
}

export interface RunLayoutLintResult {
  rules: Rule[];
  results: RuleResult[];
}

export async function runLayoutLint({
  specText,
  wasmUrl,
  resolve,
  locateFile,
}: RunLayoutLintOptions): Promise<RunLayoutLintResult> {
  if (!specText) throw new Error("specText is required");
  if (!wasmUrl)  throw new Error("wasmUrl is required");

  const parser = await getParser(wasmUrl, locateFile);
  const tree = parser.parse(specText);
  const rules = extractRules(tree, specText);
  const results = evaluateRules(rules, resolve);

  return { rules, results };
}
