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

  collectSyntaxDiagnostics(root as unknown as NodeLike, source, diagnostics);

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
        buildCountRule(
          countScope,
          countPattern,
          countExactToken,
          countMinToken,
          countMaxToken,
          countComparatorToken
        )
      );
      continue;
    }

    if (visibilityRelation) {
      rules.push(buildVisibilityRule(element, negated, visibilityRelation));
      continue;
    }

    if (cssProperty && cssMatchMode && cssValueToken) {
      rules.push(buildCssRule(element, negated, cssProperty, cssMatchMode, cssValueToken));
      continue;
    }

    if (textMatchMode && textValueToken) {
      rules.push(buildTextRule(element, negated, textMatchMode, textValueToken, textOperationTokens));
      continue;
    }

    if (alignedAxis && alignedMode) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      rules.push(...buildAlignedRules(element, negated, target, alignedAxis, alignedMode, distance));
      continue;
    }

    if (centeredAxis && centeredScope) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      rules.push(...buildCenteredRules(element, negated, target, centeredAxis, distance));
      continue;
    }

    if (sizeProperty === "width" || sizeProperty === "height") {
      const target = txt(node.childForFieldName("target"));
      const targetPropertyToken = txt(node.childForFieldName("target_size_property"));
      const sizeDistancePxToken = txt(node.childForFieldName("size_distance_px"));
      const sizeDistancePctToken = txt(node.childForFieldName("size_distance_pct"));

      rules.push(
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
        )
      );
      continue;
    }

    const insideRelation = detectInsideRelation(node, relation);
    if (insideRelation) {
      const target = txt(node.childForFieldName("target"));
      const insideOffsets = extractInsideOffsets(node, txt);

      rules.push(buildInsideRule(element, negated, insideRelation, target, insideOffsets));

      continue;
    }

    if (isNearNode(node)) {
      const target = txt(node.childForFieldName("target"));
      const nearDirections = extractNearDirections(node, txt, parseDistanceToken);

      rules.push(buildNearRule(element, negated, target, nearDirections));
      
      continue;
    }

    const distTok  = txt(node.childForFieldName("distance"));
    const distance = parseDistanceToken(distTok);

    if (relation === "equal-gap-x" || relation === "equal-gap-y") {
      rules.push(
        ...buildEqualGapRules(
          element,
          negated,
          relation,
          node,
          txt,
          distance
        )
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

    rules.push(buildDefaultRelationRule(element, negated, relation, target, target2, distance));
  }

  return { rules, diagnostics };
}
