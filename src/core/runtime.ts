import { getParser } from "./parser.js";
import { extractRules } from "./dsl.js";
import { evaluateRules } from "./evaluator.js";
import type { LayoutLintDiagnostic, Rule, RuleResult } from "./types.js";

export interface RunLayoutLintOptions {
  specText: string;
  wasmUrl?: string;
  resolve?: (id: string) => HTMLElement | null;
  locateFile?: (path: string) => string;
  /**
   * Document used for element resolution. Defaults to `globalThis.document`.
   * Pass an explicit value to lint against a synthetic DOM (e.g. JSDOM, happy-dom)
   * or omit in non-browser contexts to skip DOM evaluation entirely.
   */
  dom?: Document;
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

const semanticPrimaryLabel = (code: string): string | undefined => {
  switch (code) {
    case "LL-SEMANTIC-ELEMENT-NOT-FOUND":
      return "element not in DOM";
    case "LL-SEMANTIC-INVALID-PATTERN":
      return "invalid regular expression";
    case "LL-SEMANTIC-RULE-INCOMPLETE":
      return "missing required field";
    case "LL-SEMANTIC-INVALID-TARGET":
      return "invalid size target";
    default:
      return undefined;
  }
};

const semanticHint = (code: string): string | undefined => {
  switch (code) {
    case "LL-SEMANTIC-ELEMENT-NOT-FOUND":
      return "check the element id or the matching `define` declaration. the element may also be rendered conditionally.";
    case "LL-SEMANTIC-INVALID-PATTERN":
      return "the value supplied to a matches rule must be a valid javascript regular expression body.";
    case "LL-SEMANTIC-RULE-INCOMPLETE":
      return "count rules need a pattern. css rules need a property name.";
    case "LL-SEMANTIC-INVALID-TARGET":
      return "the referenced element resolves to a zero-width or zero-height box at evaluation time.";
    default:
      return undefined;
  }
};

export function collectSemanticDiagnostics(results: RuleResult[]): LayoutLintDiagnostic[] {
  const diagnostics: LayoutLintDiagnostic[] = [];

  results.forEach((result, index) => {
    if (!result.reason || result.pass) return;

    const code = semanticCodeFromReason(result.reason);
    diagnostics.push({
      code,
      severity: "error",
      message: result.reason,
      range: syntheticRangeForResult(result, index),
      snippet: `${result.element} ${result.relation}`,
      primaryLabel: semanticPrimaryLabel(code),
      hint: semanticHint(code),
    });
  });

  return diagnostics;
}

/**
 * Parsed form of a spec: the rules, alias definitions, and any syntax/extract
 * diagnostics. Parsing is pure in `specText`, so callers that evaluate the same
 * spec repeatedly (e.g. the monitor reacting to DOM changes) can parse once and
 * re-measure many times instead of re-running the tree-sitter parser per frame.
 */
export interface ParsedSpec {
  rules: Rule[];
  definitions: Map<string, string>;
  parseDiagnostics: LayoutLintDiagnostic[];
}

export interface ParseSpecOptions {
  specText: string;
  wasmUrl?: string;
  locateFile?: (path: string) => string;
}

/** Parse a spec into rules + definitions. Loads the WASM parser on demand. */
export async function parseSpec({
  specText,
  wasmUrl,
  locateFile,
}: ParseSpecOptions): Promise<ParsedSpec> {
  if (!specText) throw new Error("specText is required");

  const parser = await getParser(wasmUrl, locateFile);
  const tree = parser.parse(specText);
  const { rules, definitions, diagnostics: parseDiagnostics } = extractRules(tree, specText);

  return { rules, definitions, parseDiagnostics };
}

export interface EvaluateParsedSpecOptions {
  resolve?: (id: string) => HTMLElement | null;
  /**
   * Document used for element resolution. Defaults to `globalThis.document`.
   * Pass an explicit value to lint against a synthetic DOM (e.g. JSDOM, happy-dom)
   * or omit in non-browser contexts to skip DOM evaluation entirely.
   */
  dom?: Document;
}

/**
 * Measure an already-parsed spec against the DOM. This is the hot path: it does
 * no parsing, only element resolution and geometry checks, so it is cheap enough
 * to run on every relevant DOM mutation.
 */
export function evaluateParsedSpec(
  { rules, definitions, parseDiagnostics }: ParsedSpec,
  { resolve, dom }: EvaluateParsedSpecOptions = {}
): RunLayoutLintResult {
  const doc: Document | undefined = dom ?? (typeof document !== "undefined" ? document : undefined);

  // Headless mode: no DOM available. Return parse/extract diagnostics so the
  // caller can still surface syntax problems without an evaluation phase.
  if (!doc) {
    return { rules, results: [], diagnostics: parseDiagnostics, definitions };
  }

  const baseResolve = resolve ?? ((id: string) => doc.getElementById(id));

  // Pre-compute wildcard definitions (keys ending with *) for numbered lookups
  const wildcardDefs: { prefix: string; selector: string }[] = [];
  for (const [name, selector] of definitions) {
    if (name.endsWith("*")) {
      wildcardDefs.push({ prefix: name.slice(0, -1), selector });
    }
  }

  // Cache querySelectorAll results per selector to avoid repeated DOM queries
  const wildcardCache = new Map<string, HTMLElement[]>();

  // Id-pattern count rules (e.g. `count any set-* is 5`) fall back to scanning
  // the whole document for elements with an id. Compute that scan once per
  // evaluation and share it across every id-pattern rule; the DOM is stable
  // within a single synchronous evaluation, so this is safe and avoids a
  // full-document query per such rule on large pages.
  let idElements: HTMLElement[] | null = null;
  const getIdElements = (): HTMLElement[] => {
    if (idElements == null) {
      idElements = Array.from(doc.querySelectorAll<HTMLElement>("[id]")).filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      );
    }
    return idElements;
  };

  const resolveWithDefinitions = (id: string): HTMLElement | null => {
    // 1. Exact match in definitions
    const selector = definitions.get(id);
    if (selector) return doc.querySelector<HTMLElement>(selector);

    // 2. Wildcard match: card-1 → prefix "card-", index 1
    for (const { prefix, selector: wcSelector } of wildcardDefs) {
      if (id.startsWith(prefix)) {
        const suffix = id.slice(prefix.length);
        const index = Number(suffix);
        if (Number.isInteger(index) && index >= 1) {
          if (!wildcardCache.has(wcSelector)) {
            wildcardCache.set(
              wcSelector,
              Array.from(doc.querySelectorAll<HTMLElement>(wcSelector))
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

  // Resolve count patterns through definitions so they can target arbitrary
  // CSS selectors, not just element ids. The pattern is matched against:
  //   1. an exact definition  (e.g. `define cards as ".card"`)
  //   2. a wildcard definition (e.g. `define card-* as ".artwork"`)
  //   3. the original id-based wildcard fallback (querySelectorAll("[id]")).
  const resolvePatternWithDefinitions = (pattern: string): HTMLElement[] => {
    const exact = definitions.get(pattern);
    if (exact) {
      return Array.from(doc.querySelectorAll<HTMLElement>(exact));
    }

    for (const { prefix, selector: wcSelector } of wildcardDefs) {
      const wildcardName = `${prefix}*`;
      if (pattern === wildcardName || pattern.startsWith(prefix)) {
        if (!wildcardCache.has(wcSelector)) {
          wildcardCache.set(
            wcSelector,
            Array.from(doc.querySelectorAll<HTMLElement>(wcSelector))
          );
        }
        return wildcardCache.get(wcSelector)!;
      }
    }

    if (typeof document === "undefined") return [];
    const matcher = idPatternToRegex(pattern);
    return getIdElements().filter((node) => matcher.test(node.id));
  };

  const results = evaluateRules(rules, resolveWithDefinitions, resolvePatternWithDefinitions);
  const semanticDiagnostics = collectSemanticDiagnostics(results);
  const diagnostics = [...parseDiagnostics, ...semanticDiagnostics];

  return { rules, results, diagnostics, definitions };
}

/**
 * Parse and evaluate a spec in one call. Convenience wrapper around
 * `parseSpec` + `evaluateParsedSpec` for callers that evaluate a spec once.
 * Long-lived callers that re-measure the same spec should hold the
 * `ParsedSpec` and call `evaluateParsedSpec` directly to skip re-parsing.
 */
export async function runLayoutLint({
  specText,
  wasmUrl,
  resolve,
  locateFile,
  dom,
}: RunLayoutLintOptions): Promise<RunLayoutLintResult> {
  const parsed = await parseSpec({ specText, wasmUrl, locateFile });
  return evaluateParsedSpec(parsed, { resolve, dom });
}

function idPatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/#/g, "\\d+");
  return new RegExp(`^${escaped}$`);
}
