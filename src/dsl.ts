import type { Tree } from "web-tree-sitter";

export interface Rule {
  element: string;
  negated?: boolean;
  relation: string;
  textExpected?: string;
  textOperations?: Array<"lowercase" | "uppercase" | "singleline">;
  cssProperty?: string;
  cssExpected?: string;
  countPattern?: string;
  countExpected?: number;
  countMin?: number;
  countMax?: number;
  comparator?: "<" | "<=" | ">" | ">=";
  target?: string;  // optional for absolute rules like distance-from-top
  target2?: string; // optional for ternary rules like equal-gap-x/equal-gap-y
  targetProperty?: "width" | "height";
  distancePx?: number;  // optional for alignment relations
  distanceMinPx?: number; // optional for range constraints like 5 to 15px
  distanceMaxPx?: number; // optional for range constraints like 5 to 15px
  distancePct?: number;
  distanceMinPct?: number;
  distanceMaxPct?: number;
  nearDirections?: Array<{
    directions: string[];
    distancePx?: number;
    distanceMinPx?: number;
    distanceMaxPx?: number;
  }>;  // for near relations: array of {directions, distance} pairs
  insideOffsets?: Array<{
    sides: string[];
    offsetPx: number;
  }>; // for inside/partially-inside relations
}

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

function parseQuotedTextToken(token: string): string {
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

export function extractRules(tree: Tree | null, source: string): Rule[] {
  if (!tree) return []; // return empty array if tree is null

  const root = tree.rootNode;
  const txt = (n: any) => n ? source.slice(n.startIndex, n.endIndex) : "";
  const parseSignedDistanceToken = (token: string): number | null => {
    const normalized = token.trim().replace(/\s+/g, " ");
    const exact = normalized.match(/^(-?\d+)\s*px$/i);
    if (!exact) return null;
    return +exact[1];
  };
  const rules: Rule[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    if (!node) continue; // skip if null

    const element  = txt(node.childForFieldName("element"));
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
    const textOperationTokens = node
      .childrenForFieldName("text_operation")
      .map((operationNode: any) => txt(operationNode))
      .filter((operation: string) =>
        operation === "lowercase" || operation === "uppercase" || operation === "singleline"
      ) as Array<"lowercase" | "uppercase" | "singleline">;

    if (countScope && countPattern) {
      rules.push({
        element: "global",
        relation: `count-${countScope}`,
        countPattern,
        countExpected: countExactToken ? +countExactToken : undefined,
        countMin: countMinToken ? +countMinToken : undefined,
        countMax: countMaxToken ? +countMaxToken : undefined,
        comparator: countComparatorToken
          ? (countComparatorToken as "<" | "<=" | ">" | ">=")
          : undefined,
      });
      continue;
    }

    if (visibilityRelation) {
      rules.push({
        element,
        negated,
        relation: visibilityRelation,
      });
      continue;
    }

    if (cssProperty && cssMatchMode && cssValueToken) {
      rules.push({
        element,
        negated,
        relation: `css-${cssMatchMode}`,
        cssProperty: cssProperty.toLowerCase(),
        cssExpected: parseQuotedTextToken(cssValueToken),
      });
      continue;
    }

    if (textMatchMode && textValueToken) {
      rules.push({
        element,
        negated,
        relation: `text-${textMatchMode}`,
        textExpected: parseQuotedTextToken(textValueToken),
        textOperations: textOperationTokens,
      });
      continue;
    }

    if (alignedAxis && alignedMode) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      const relationMap: Record<string, string[]> = {
        "horizontally:all": ["aligned-top", "aligned-bottom"],
        "horizontally:top": ["aligned-top"],
        "horizontally:bottom": ["aligned-bottom"],
        "horizontally:centered": ["centered-y"],
        "vertically:all": ["aligned-left", "aligned-right"],
        "vertically:left": ["aligned-left"],
        "vertically:right": ["aligned-right"],
        "vertically:centered": ["centered-x"],
      };

      const mappedRelations = relationMap[`${alignedAxis}:${alignedMode}`] || [];
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
      continue;
    }

    if (centeredAxis && centeredScope) {
      const target = txt(node.childForFieldName("target"));
      const distTok = txt(node.childForFieldName("distance"));
      const distance = parseDistanceToken(distTok);

      const centeredRelationMap: Record<string, string[]> = {
        horizontally: ["centered-x"],
        vertically: ["centered-y"],
        all: ["centered-x", "centered-y"],
      };

      const mappedRelations = centeredRelationMap[centeredAxis] || [];
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
      continue;
    }

    if (sizeProperty === "width" || sizeProperty === "height") {
      const target = txt(node.childForFieldName("target"));
      const targetPropertyToken = txt(node.childForFieldName("target_size_property"));
      const sizeDistancePxToken = txt(node.childForFieldName("size_distance_px"));
      const sizeDistancePctToken = txt(node.childForFieldName("size_distance_pct"));

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
      rules.push(rule);
      continue;
    }
    
    // Handle near rules specially
    const isNear = node.childForFieldName("near") !== null || 
                   (node.childCount > 0 && node.child(1)?.text === "near");

    const relationToken = relation;
    const rawTokens = node.text.trim().split(/\s+/);
    const relationTokens = rawTokens.slice(1).filter((token) => token !== "not");
    const secondToken = relationTokens[0];
    const thirdToken = relationTokens[1];
    const isInside = relationToken === "inside" || secondToken === "inside";
    const isPartiallyInside =
      relationToken === "partially-inside" ||
      (secondToken === "partially" && thirdToken === "inside");

    if (isInside || isPartiallyInside) {
      const target = txt(node.childForFieldName("target"));
      const insideClauses = node.childrenForFieldName("inside_clause");

      const insideOffsets: Array<{ sides: string[]; offsetPx: number }> = [];

      for (const clause of insideClauses) {
        if (!clause) continue;

        const distanceToken = txt(clause.childForFieldName("distance"));
        const offsetPx = parseSignedDistanceToken(distanceToken);
        if (offsetPx == null) continue;

        const sideNodes = clause.childrenForFieldName("side");
        const sides = sideNodes
          .map((sideNode: any) => txt(sideNode))
          .filter(Boolean);

        if (sides.length > 0) {
          insideOffsets.push({ sides, offsetPx });
        }
      }

      rules.push({
        element,
        negated,
        relation: isPartiallyInside ? "partially-inside" : "inside",
        target,
        insideOffsets,
      });

      continue;
    }
    
    if (isNear) {
      const target = txt(node.childForFieldName("target"));
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
          .map((dirNode: any) => txt(dirNode))
          .filter(Boolean);
        
        if (directions.length > 0) {
          nearDirections.push({ directions, ...distance });
        }
      }
      
      rules.push({
        element,
        negated,
        relation: "near",
        target,
        nearDirections
      });
      
      continue;
    }

    const distTok  = txt(node.childForFieldName("distance")); // e.g. "20px"
    const distance = parseDistanceToken(distTok);

    if (relation === "equal-gap-x" || relation === "equal-gap-y") {
      const directTarget = txt(node.childForFieldName("target"));
      const directTarget2 = txt(node.childForFieldName("target2"));
      const chainTargetNodes = node.childrenForFieldName("chain_target");
      const chainTargets = chainTargetNodes
        .map((targetNode: any) => txt(targetNode))
        .filter(Boolean);

      const targets = [directTarget, directTarget2, ...chainTargets].filter(Boolean);
      const chain = [element, ...targets];

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

      continue;
    }

    const target   = txt(node.childForFieldName("target"));
    const target2  = txt(node.childForFieldName("target2"));

    const rule: Rule = {
      element,
      negated,
      relation,
      target,
      target2
    };
    Object.assign(rule, distance);

    rules.push(rule);
  }

  return rules;
}
