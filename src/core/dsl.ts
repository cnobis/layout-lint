import type { Tree } from "web-tree-sitter";
import type { LayoutLintDiagnostic, Rule } from "./types.js";
import {
  buildAlignedRules,
  buildCountRule,
  buildDefaultRelationRule,
  buildCenteredRules,
  buildCssRule,
  buildEqualGapRules,
  buildInsideRule,
  buildNearRule,
  buildSizeRule,
  buildTextRule,
  buildVisibilityRule,
  detectInsideRelation,
  type NodeLike,
  type NodeTextReader,
  extractRuleNodeInfo,
  extractInsideOffsets,
  extractNearDirections,
  extractTextOperationTokens,
  getSourceRange,
  isNearNode,
} from "./dsl-helpers.js";

export function parseDistanceToken(token: string): {
  distancePx?: number;
  distanceMinPx?: number;
  distanceMaxPx?: number;
} {
  const normalized = token.trim().replace(/\s+/g, " ");

  const exact = normalized.match(/^(\d+)\s*px$/i);
  if (exact) {
    return { distancePx: +exact[1] };
  }

  const range = normalized.match(/^(\d+)\s+to\s+(\d+)\s*px$/i);
  if (range) {
    const min = +range[1];
    const max = +range[2];
    return {
      distanceMinPx: Math.min(min, max),
      distanceMaxPx: Math.max(min, max),
    };
  }

  return {};
}

export function parsePercentageToken(token: string): {
  distancePct?: number;
  distanceMinPct?: number;
  distanceMaxPct?: number;
} {
  const normalized = token.trim().replace(/\s+/g, " ");

  const exact = normalized.match(/^(\d+)\s*%$/i);
  if (exact) {
    return { distancePct: +exact[1] };
  }

  const range = normalized.match(/^(\d+)\s+to\s+(\d+)\s*%$/i);
  if (range) {
    const min = +range[1];
    const max = +range[2];
    return {
      distanceMinPct: Math.min(min, max),
      distanceMaxPct: Math.max(min, max),
    };
  }

  return {};
}

export interface ExtractRulesResult {
  rules: Rule[];
  diagnostics: LayoutLintDiagnostic[];
}

function withSourceRange(rule: Rule, node: NodeLike, source: string): Rule {
  return {
    ...rule,
    sourceRange: getSourceRange(source, node.startIndex, node.endIndex),
  };
}

function withSourceRangeMany(rules: Rule[], node: NodeLike, source: string): Rule[] {
  return rules.map((rule) => withSourceRange(rule, node, source));
}

const DSL_KEYWORDS = [
  "above",
  "below",
  "left-of",
  "right-of",
  "near",
  "inside",
  "partially-inside",
  "aligned-left",
  "aligned-right",
  "aligned-top",
  "aligned-bottom",
  "centered-x",
  "centered-y",
  "equal-gap-x",
  "equal-gap-y",
  "visible",
  "hidden",
  "absent",
  "count",
  "any",
  "text",
  "css",
  "is",
  "starts-with",
  "ends-with",
  "contains",
  "matches",
  "width",
  "height",
  "of",
  "to",
  "px",
  "not",
];

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const maxSuggestionDistance = (tokenLength: number) => (tokenLength <= 5 ? 1 : 2);

function findKeywordSuggestion(snippet: string | undefined): string | undefined {
  if (!snippet) return undefined;

  const candidates = (snippet.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [])
    .filter((token) => !DSL_KEYWORDS.includes(token));
  if (candidates.length === 0) return undefined;

  let best: { keyword: string; distance: number; tokenLength: number } | null = null;

  for (const token of candidates) {
    for (const keyword of DSL_KEYWORDS) {
      const distance = levenshteinDistance(token, keyword);
      if (!best || distance < best.distance) {
        best = { keyword, distance, tokenLength: token.length };
      }
    }
  }

  if (!best) return undefined;
  return best.distance <= maxSuggestionDistance(best.tokenLength) ? best.keyword : undefined;
}

function collapseSyntaxDiagnostics(rawDiagnostics: LayoutLintDiagnostic[]): LayoutLintDiagnostic[] {
  if (rawDiagnostics.length <= 1) {
    return rawDiagnostics.map((diagnostic) => {
      const suggestion = diagnostic.code === "LL-PARSE-SYNTAX"
        ? findKeywordSuggestion(diagnostic.snippet)
        : undefined;
      return suggestion ? { ...diagnostic, suggestion } : diagnostic;
    });
  }

  const sorted = [...rawDiagnostics].sort(
    (a, b) => a.range.startIndex - b.range.startIndex || a.range.endIndex - b.range.endIndex
  );
  const collapsed: LayoutLintDiagnostic[] = [];

  for (const diagnostic of sorted) {
    const last = collapsed[collapsed.length - 1];
    if (last && diagnostic.range.startIndex <= last.range.endIndex + 1) {
      if (!last.relatedDiagnostics) {
        last.relatedDiagnostics = [];
      }
      last.relatedDiagnostics.push({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        range: diagnostic.range,
        snippet: diagnostic.snippet,
      });
      continue;
    }
    collapsed.push({ ...diagnostic });
  }

  return collapsed.map((diagnostic) => {
    const suggestion = diagnostic.code === "LL-PARSE-SYNTAX"
      ? findKeywordSuggestion(diagnostic.snippet)
      : undefined;
    const relatedDiagnostics = (diagnostic.relatedDiagnostics ?? []).map((related) => {
      const relatedSuggestion = related.code === "LL-PARSE-SYNTAX"
        ? findKeywordSuggestion(related.snippet)
        : undefined;

      if (!relatedSuggestion) return related;
      return {
        ...related,
        suggestion: relatedSuggestion,
      };
    });

    const relatedCount = relatedDiagnostics.length;
    if (relatedCount <= 0 && !suggestion) return diagnostic;

    return {
      ...diagnostic,
      message: diagnostic.message,
      suggestion,
      relatedDiagnosticsCount: relatedCount > 0 ? relatedCount : undefined,
      relatedDiagnostics: relatedCount > 0 ? relatedDiagnostics : undefined,
    };
  });
}

function collectSyntaxDiagnostics(node: NodeLike | null, source: string, diagnostics: LayoutLintDiagnostic[]) {
  if (!node) return;

  const isErrorNode = node.type === "ERROR";
  const isMissingNode = node.isMissing === true;
  if (isErrorNode || isMissingNode) {
    const snippet = source.slice(node.startIndex, node.endIndex).trim();
    diagnostics.push({
      code: isMissingNode ? "LL-PARSE-MISSING" : "LL-PARSE-SYNTAX",
      severity: "error",
      message: isMissingNode
        ? "Incomplete spec segment. A required token appears to be missing."
        : "Invalid spec syntax near this segment.",
      range: getSourceRange(source, node.startIndex, node.endIndex),
      snippet: snippet || undefined,
    });
  }

  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    collectSyntaxDiagnostics(child, source, diagnostics);
  }
}

export function extractRules(tree: Tree | null, source: string): ExtractRulesResult {
  if (!tree) return { rules: [], diagnostics: [] };

  const root = tree.rootNode;
  const txt: NodeTextReader = (node) => (node ? source.slice(node.startIndex, node.endIndex) : "");
  const rules: Rule[] = [];
  const diagnostics: LayoutLintDiagnostic[] = [];

  const syntaxDiagnostics: LayoutLintDiagnostic[] = [];
  collectSyntaxDiagnostics(root as unknown as NodeLike, source, syntaxDiagnostics);
  diagnostics.push(...collapseSyntaxDiagnostics(syntaxDiagnostics));

  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i) as unknown as NodeLike | null;
    if (!node) continue;

    const {
      element,
      relation,
      negated,
      sizeProperty,
      comparatorToken,
      alignedAxis,
      alignedMode,
      centeredAxis,
      centeredScope,
      visibilityRelation,
      countScope,
      countPattern,
      countExactToken,
      countMinToken,
      countMaxToken,
      countComparatorToken,
      textMatchMode,
      textValueToken,
      cssProperty,
      cssMatchMode,
      cssValueToken,
    } = extractRuleNodeInfo(node, txt);
    const textOperationTokens = extractTextOperationTokens(node, txt);

    if (countScope && countPattern) {
      rules.push(
        withSourceRange(
          buildCountRule(
          countScope,
          countPattern,
          countExactToken,
          countMinToken,
          countMaxToken,
          countComparatorToken
          ),
          node,
          source
        )
      );
      continue;
    }

    if (visibilityRelation) {
      rules.push(withSourceRange(buildVisibilityRule(element, negated, visibilityRelation), node, source));
      continue;
    }

    if (cssProperty && cssMatchMode && cssValueToken) {
      rules.push(withSourceRange(buildCssRule(element, negated, cssProperty, cssMatchMode, cssValueToken), node, source));
      continue;
    }

    if (textMatchMode && textValueToken) {
      rules.push(withSourceRange(buildTextRule(element, negated, textMatchMode, textValueToken, textOperationTokens), node, source));
      continue;
    }

    if (alignedAxis && alignedMode) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      rules.push(...withSourceRangeMany(buildAlignedRules(element, negated, target, alignedAxis, alignedMode, distance), node, source));
      continue;
    }

    if (centeredAxis && centeredScope) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      rules.push(...withSourceRangeMany(buildCenteredRules(element, negated, target, centeredAxis, distance), node, source));
      continue;
    }

    if (sizeProperty === "width" || sizeProperty === "height") {
      const target = txt(node.childForFieldName("target"));
      const targetPropertyToken = txt(node.childForFieldName("target_size_property"));
      const sizeDistancePxToken = txt(node.childForFieldName("size_distance_px"));
      const sizeDistancePctToken = txt(node.childForFieldName("size_distance_pct"));

      rules.push(
        withSourceRange(
          buildSizeRule(
          element,
          negated,
          sizeProperty,
          comparatorToken,
          target,
          targetPropertyToken,
          sizeDistancePxToken,
          sizeDistancePctToken,
          parseDistanceToken,
          parsePercentageToken
          ),
          node,
          source
        )
      );
      continue;
    }

    const insideRelation = detectInsideRelation(node, relation);
    if (insideRelation) {
      const target = txt(node.childForFieldName("target"));
      const insideOffsets = extractInsideOffsets(node, txt);

      rules.push(withSourceRange(buildInsideRule(element, negated, insideRelation, target, insideOffsets), node, source));

      continue;
    }

    if (isNearNode(node)) {
      const target = txt(node.childForFieldName("target"));
      const nearDirections = extractNearDirections(node, txt, parseDistanceToken);

      rules.push(withSourceRange(buildNearRule(element, negated, target, nearDirections), node, source));
      
      continue;
    }

    const distTok  = txt(node.childForFieldName("distance"));
    const distance = parseDistanceToken(distTok);

    if (relation === "equal-gap-x" || relation === "equal-gap-y") {
      rules.push(
        ...withSourceRangeMany(buildEqualGapRules(
          element,
          negated,
          relation,
          node,
          txt,
          distance
        ), node, source)
      );

      continue;
    }

    const target = txt(node.childForFieldName("target"));
    const target2 = txt(node.childForFieldName("target2"));

    if (!element || !relation) {
      diagnostics.push({
        code: "LL-RULE-MALFORMED",
        severity: "error",
        message: "Malformed rule: missing element or relation.",
        range: getSourceRange(source, node.startIndex, node.endIndex),
        snippet: txt(node).trim() || undefined,
      });
      continue;
    }

    rules.push(withSourceRange(buildDefaultRelationRule(element, negated, relation, target, target2, distance), node, source));
  }

  return { rules, diagnostics };
}
