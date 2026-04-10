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
  definitions?: Map<string, string>;
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
  const { rules, definitions, diagnostics: parseDiagnostics } = extractRules(tree, specText);

  const baseResolve = resolve ?? ((id: string) => document.getElementById(id));

  // Pre-compute wildcard definitions (keys ending with *) for numbered lookups
  const wildcardDefs: { prefix: string; selector: string }[] = [];
  for (const [name, selector] of definitions) {
    if (name.endsWith("*")) {
      wildcardDefs.push({ prefix: name.slice(0, -1), selector });
    }
  }

  // Cache querySelectorAll results per selector to avoid repeated DOM queries
  const wildcardCache = new Map<string, HTMLElement[]>();

  const resolveWithDefinitions = (id: string): HTMLElement | null => {
    // 1. Exact match in definitions
    const selector = definitions.get(id);
    if (selector) return document.querySelector<HTMLElement>(selector);

    // 2. Wildcard match: card-1 → prefix "card-", index 1
    for (const { prefix, selector: wcSelector } of wildcardDefs) {
      if (id.startsWith(prefix)) {
        const suffix = id.slice(prefix.length);
        const index = Number(suffix);
        if (Number.isInteger(index) && index >= 1) {
          if (!wildcardCache.has(wcSelector)) {
            wildcardCache.set(
              wcSelector,
              Array.from(document.querySelectorAll<HTMLElement>(wcSelector))
            );
          }
          const elements = wildcardCache.get(wcSelector)!;
          return elements[index - 1] ?? null;
        }
      }
    }

    // 3. Fallback to base resolution
    return baseResolve(id);
  };

  const results = evaluateRules(rules, resolveWithDefinitions);
  const semanticDiagnostics = collectSemanticDiagnostics(results);
  const diagnostics = [...parseDiagnostics, ...semanticDiagnostics];

  return { rules, results, diagnostics, definitions };
}
