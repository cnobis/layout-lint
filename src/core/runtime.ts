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

const syntheticRangeForResult = (rule: Rule, index: number) =>
  rule.sourceRange ?? {
    startIndex: 0,
    endIndex: 0,
    start: { line: index + 1, column: 0 },
    end: { line: index + 1, column: 0 },
  };

const semanticCodeFromReason = (reason: string) => {
  if (reason.startsWith("Element not found:")) return "LL-SEMANTIC-ELEMENT-NOT-FOUND";
  if (reason.startsWith("Invalid regular expression:")) return "LL-SEMANTIC-INVALID-PATTERN";
  if (reason.startsWith("Missing count pattern in rule") || reason.startsWith("Missing css property in rule")) {
    return "LL-SEMANTIC-RULE-INCOMPLETE";
  }
  if (reason.startsWith("Invalid target size for:")) return "LL-SEMANTIC-INVALID-TARGET";
  return "LL-SEMANTIC-EVALUATION";
};

export function collectSemanticDiagnostics(results: RuleResult[]): LayoutLintDiagnostic[] {
  const diagnostics: LayoutLintDiagnostic[] = [];

  results.forEach((result, index) => {
    if (!result.reason || result.pass) return;

    diagnostics.push({
      code: semanticCodeFromReason(result.reason),
      severity: "error",
      message: result.reason,
      range: syntheticRangeForResult(result, index),
      snippet: `${result.element} ${result.relation}`,
    });
  });

  return diagnostics;
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
  const { rules, diagnostics: parseDiagnostics } = extractRules(tree, specText);
  const results = evaluateRules(rules, resolve);
  const semanticDiagnostics = collectSemanticDiagnostics(results);
  const diagnostics = [...parseDiagnostics, ...semanticDiagnostics];

  return { rules, results, diagnostics };
}
