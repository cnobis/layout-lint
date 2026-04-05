import type { LayoutLintSourcePosition, LayoutLintSourceRange, Rule } from "./types.js";

export interface NodeLike {
  text: string;
  type: string;
  isMissing?: boolean;
  startIndex: number;
  endIndex: number;
  childCount: number;
  child(index: number): NodeLike | null;
  childForFieldName(name: string): NodeLike | null;
  childrenForFieldName(name: string): NodeLike[];
}

export type NodeTextReader = (node: NodeLike | null | undefined) => string;

export function getSourcePosition(source: string, index: number): LayoutLintSourcePosition {
  const boundedIndex = Math.min(Math.max(index, 0), source.length);
  let line = 1;
  let column = 0;

  for (let i = 0; i < boundedIndex; i += 1) {
    if (source[i] === "\n") {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

export function getSourceRange(source: string, startIndex: number, endIndex: number): LayoutLintSourceRange {
  const normalizedStart = Math.min(Math.max(startIndex, 0), source.length);
  const normalizedEnd = Math.min(Math.max(endIndex, normalizedStart), source.length);

  return {
    startIndex: normalizedStart,
    endIndex: normalizedEnd,
    start: getSourcePosition(source, normalizedStart),
    end: getSourcePosition(source, normalizedEnd),
  };
}

export type PxDistanceToken = {
  distancePx?: number;
  distanceMinPx?: number;
  distanceMaxPx?: number;
};

export type PctDistanceToken = {
  distancePct?: number;
  distanceMinPct?: number;
  distanceMaxPct?: number;
};

export type PxDistanceParser = (token: string) => PxDistanceToken;
export type PctDistanceParser = (token: string) => PctDistanceToken;

export interface RuleNodeInfo {
  element: string;
  relation: string;
  negated: boolean;
  sizeProperty: string;
  comparatorToken: string;
  alignedAxis: string;
  alignedMode: string;
  centeredAxis: string;
  centeredScope: string;
  visibilityRelation: string;
  countScope: string;
  countPattern: string;
  countExactToken: string;
  countMinToken: string;
  countMaxToken: string;
  countComparatorToken: string;
  textMatchMode: string;
  textValueToken: string;
  cssProperty: string;
  cssMatchMode: string;
  cssValueToken: string;
}

export function extractRuleNodeInfo(node: NodeLike, txt: NodeTextReader): RuleNodeInfo {
  const element = txt(node.childForFieldName("element"));
  const relation = txt(node.childForFieldName("relation"));
  const negated = txt(node.childForFieldName("negated")) === "not";
  const sizeProperty = txt(node.childForFieldName("size_property"));
  const comparatorToken = txt(node.childForFieldName("comparator"));
  const alignedAxis = txt(node.childForFieldName("aligned_axis"));
  const alignedMode = txt(node.childForFieldName("aligned_mode"));
  const centeredAxis = txt(node.childForFieldName("centered_axis"));
  const centeredScope = txt(node.childForFieldName("centered_scope"));
  const visibilityRelation = txt(node.childForFieldName("visibility_relation"));
  const countScope = txt(node.childForFieldName("count_scope"));
  const countPattern = txt(node.childForFieldName("count_pattern"));
  const countExactToken = txt(node.childForFieldName("count_exact"));
  const countMinToken = txt(node.childForFieldName("count_min"));
  const countMaxToken = txt(node.childForFieldName("count_max"));
  const countComparatorToken = txt(node.childForFieldName("count_comparator"));
  const textMatchMode = txt(node.childForFieldName("text_match_mode"));
  const textValueToken = txt(node.childForFieldName("text_value"));
  const cssProperty = txt(node.childForFieldName("css_property"));
  const cssMatchMode = txt(node.childForFieldName("css_match_mode"));
  const cssValueToken = txt(node.childForFieldName("css_value"));

  return {
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
  };
}

export function parseQuotedTextToken(token: string): string {
  const normalized = token.trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    try {
      return JSON.parse(normalized);
    } catch {
      return normalized.slice(1, -1);
    }
  }
  return normalized;
}

export function parseSignedDistanceToken(token: string): number | null {
  const normalized = token.trim().replace(/\s+/g, " ");
  const exact = normalized.match(/^(-?\d+)\s*px$/i);
  if (!exact) return null;
  return +exact[1];
}

const alignedRelationMap: Record<string, string[]> = {
  "horizontally:all": ["aligned-top", "aligned-bottom"],
  "horizontally:top": ["aligned-top"],
  "horizontally:bottom": ["aligned-bottom"],
  "horizontally:centered": ["centered-y"],
  "vertically:all": ["aligned-left", "aligned-right"],
  "vertically:left": ["aligned-left"],
  "vertically:right": ["aligned-right"],
  "vertically:centered": ["centered-x"],
};

export function mapAlignedRelations(axis: string, mode: string): string[] {
  return alignedRelationMap[`${axis}:${mode}`] || [];
}

const centeredRelationMap: Record<string, string[]> = {
  horizontally: ["centered-x"],
  vertically: ["centered-y"],
  all: ["centered-x", "centered-y"],
};

export function mapCenteredRelations(axis: string): string[] {
  return centeredRelationMap[axis] || [];
}

export function extractTextOperationTokens(node: NodeLike, txt: NodeTextReader): Array<"lowercase" | "uppercase" | "singleline"> {
  return node
    .childrenForFieldName("text_operation")
    .map((operationNode) => txt(operationNode))
    .filter((operation: string) =>
      operation === "lowercase" || operation === "uppercase" || operation === "singleline"
    ) as Array<"lowercase" | "uppercase" | "singleline">;
}

export function buildCountRule(
  countScope: string,
  countPattern: string,
  countExactToken: string,
  countMinToken: string,
  countMaxToken: string,
  countComparatorToken: string
): Rule {
  return {
    element: "global",
    relation: `count-${countScope}`,
    countPattern,
    countExpected: countExactToken ? +countExactToken : undefined,
    countMin: countMinToken ? +countMinToken : undefined,
    countMax: countMaxToken ? +countMaxToken : undefined,
    comparator: countComparatorToken
      ? (countComparatorToken as "<" | "<=" | ">" | ">=")
      : undefined,
  };
}

export function buildVisibilityRule(
  element: string,
  negated: boolean,
  visibilityRelation: string
): Rule {
  return {
    element,
    negated,
    relation: visibilityRelation,
  };
}

export function buildCssRule(
  element: string,
  negated: boolean,
  cssProperty: string,
  cssMatchMode: string,
  cssValueToken: string
): Rule {
  return {
    element,
    negated,
    relation: `css-${cssMatchMode}`,
    cssProperty: cssProperty.toLowerCase(),
    cssExpected: parseQuotedTextToken(cssValueToken),
  };
}

export function buildTextRule(
  element: string,
  negated: boolean,
  textMatchMode: string,
  textValueToken: string,
  textOperationTokens: Array<"lowercase" | "uppercase" | "singleline">
): Rule {
  return {
    element,
    negated,
    relation: `text-${textMatchMode}`,
    textExpected: parseQuotedTextToken(textValueToken),
    textOperations: textOperationTokens,
  };
}

export function extractInsideOffsets(node: NodeLike, txt: NodeTextReader): Array<{ sides: string[]; offsetPx: number }> {
  const insideClauses = node.childrenForFieldName("inside_clause");
  const insideOffsets: Array<{ sides: string[]; offsetPx: number }> = [];

  for (const clause of insideClauses) {
    if (!clause) continue;

    const distanceToken = txt(clause.childForFieldName("distance"));
    const offsetPx = parseSignedDistanceToken(distanceToken);
    if (offsetPx == null) continue;

    const sideNodes = clause.childrenForFieldName("side");
    const sides = sideNodes
      .map((sideNode) => txt(sideNode))
      .filter(Boolean);

    if (sides.length > 0) {
      insideOffsets.push({ sides, offsetPx });
    }
  }

  return insideOffsets;
}

export function extractNearDirections(
  node: NodeLike,
  txt: NodeTextReader,
  parseDistanceToken: PxDistanceParser
): Array<{
  directions: string[];
  distancePx?: number;
  distanceMinPx?: number;
  distanceMaxPx?: number;
}> {
  const nearClauses = node.childrenForFieldName("near_clause");
  const nearDirections: Array<{
    directions: string[];
    distancePx?: number;
    distanceMinPx?: number;
    distanceMaxPx?: number;
  }> = [];

  for (const clause of nearClauses) {
    if (!clause) continue;

    const distTok = txt(clause.childForFieldName("distance"));
    const distance = parseDistanceToken(distTok);

    const directionNodes = clause.childrenForFieldName("direction");
    const directions = directionNodes
      .map((dirNode) => txt(dirNode))
      .filter(Boolean);

    if (directions.length > 0) {
      nearDirections.push({ directions, ...distance });
    }
  }

  return nearDirections;
}

export function buildEqualGapRules(
  element: string,
  negated: boolean,
  relation: "equal-gap-x" | "equal-gap-y",
  node: NodeLike,
  txt: NodeTextReader,
  distance: PxDistanceToken
): Rule[] {
  const directTarget = txt(node.childForFieldName("target"));
  const directTarget2 = txt(node.childForFieldName("target2"));
  const chainTargetNodes = node.childrenForFieldName("chain_target");
  const chainTargets = chainTargetNodes
    .map((targetNode) => txt(targetNode))
    .filter(Boolean);

  const targets = [directTarget, directTarget2, ...chainTargets].filter(Boolean);
  const chain = [element, ...targets];
  const rules: Rule[] = [];

  for (let j = 0; j <= chain.length - 3; j++) {
    const rule: Rule = {
      element: chain[j],
      negated,
      relation,
      target: chain[j + 1],
      target2: chain[j + 2]
    };
    Object.assign(rule, distance);
    rules.push(rule);
  }

  return rules;
}

export function detectInsideRelation(node: NodeLike, relationToken: string): "inside" | "partially-inside" | null {
  const rawTokens = node.text.trim().split(/\s+/);
  const relationTokens = rawTokens.slice(1).filter((token: string) => token !== "not");
  const secondToken = relationTokens[0];
  const thirdToken = relationTokens[1];

  const isInside = relationToken === "inside" || secondToken === "inside";
  const isPartiallyInside =
    relationToken === "partially-inside" ||
    (secondToken === "partially" && thirdToken === "inside");

  if (isPartiallyInside) return "partially-inside";
  if (isInside) return "inside";
  return null;
}

export function isNearNode(node: NodeLike): boolean {
  return node.childForFieldName("near") !== null ||
    (node.childCount > 0 && node.child(1)?.text === "near");
}

export function buildAlignedRules(
  element: string,
  negated: boolean,
  target: string,
  alignedAxis: string,
  alignedMode: string,
  distance: PxDistanceToken
): Rule[] {
  const mappedRelations = mapAlignedRelations(alignedAxis, alignedMode);
  const rules: Rule[] = [];

  for (const mappedRelation of mappedRelations) {
    const rule: Rule = {
      element,
      negated,
      relation: mappedRelation,
      target,
    };
    Object.assign(rule, distance);
    rules.push(rule);
  }

  return rules;
}

export function buildCenteredRules(
  element: string,
  negated: boolean,
  target: string,
  centeredAxis: string,
  distance: PxDistanceToken
): Rule[] {
  const mappedRelations = mapCenteredRelations(centeredAxis);
  const rules: Rule[] = [];

  for (const mappedRelation of mappedRelations) {
    const rule: Rule = {
      element,
      negated,
      relation: mappedRelation,
      target,
    };
    Object.assign(rule, distance);
    rules.push(rule);
  }

  return rules;
}

export function buildSizeRule(
  element: string,
  negated: boolean,
  sizeProperty: "width" | "height",
  comparatorToken: string,
  target: string,
  targetPropertyToken: string,
  sizeDistancePxToken: string,
  sizeDistancePctToken: string,
  parseDistanceToken: PxDistanceParser,
  parsePercentageToken: PctDistanceParser
): Rule {
  const distance = sizeDistancePctToken
    ? parsePercentageToken(sizeDistancePctToken)
    : parseDistanceToken(sizeDistancePxToken);

  const rule: Rule = {
    element,
    negated,
    relation: sizeProperty,
    comparator: comparatorToken
      ? (comparatorToken as "<" | "<=" | ">" | ">=")
      : undefined,
    target: target || undefined,
    targetProperty:
      targetPropertyToken === "width" || targetPropertyToken === "height"
        ? (targetPropertyToken as "width" | "height")
        : undefined,
  };

  Object.assign(rule, distance);
  return rule;
}

export function buildInsideRule(
  element: string,
  negated: boolean,
  relation: "inside" | "partially-inside",
  target: string,
  insideOffsets: Array<{ sides: string[]; offsetPx: number }>
): Rule {
  return {
    element,
    negated,
    relation,
    target,
    insideOffsets,
  };
}

export function buildNearRule(
  element: string,
  negated: boolean,
  target: string,
  nearDirections: Array<{
    directions: string[];
    distancePx?: number;
    distanceMinPx?: number;
    distanceMaxPx?: number;
  }>
): Rule {
  return {
    element,
    negated,
    relation: "near",
    target,
    nearDirections,
  };
}

export function buildDefaultRelationRule(
  element: string,
  negated: boolean,
  relation: string,
  target: string,
  target2: string,
  distance: PxDistanceToken
): Rule {
  const rule: Rule = {
    element,
    negated,
    relation,
    target,
    target2,
  };
  Object.assign(rule, distance);
  return rule;
}
