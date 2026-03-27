import type { Tree } from "web-tree-sitter";

export interface Rule {
  element: string;
  relation: string;
  target?: string;  // optional for absolute rules like distance_from_top
  target2?: string; // optional for ternary rules like equal_gap_x/equal_gap_y
  distancePx?: number;  // optional for alignment relations
}

export function extractRules(tree: Tree | null, source: string): Rule[] {
  if (!tree) return []; // return empty array if tree is null

  const root = tree.rootNode;
  const txt = (n: any) => n ? source.slice(n.startIndex, n.endIndex) : "";
  const rules: Rule[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const node = root.namedChild(i);
    if (!node) continue; // skip if null

    const element  = txt(node.childForFieldName("element"));
    const relation = txt(node.childForFieldName("relation"));
    const distTok  = txt(node.childForFieldName("distance")); // e.g. "20px"
    const m = distTok.match(/^(\d+)px$/);

    if (relation === "equal_gap_x" || relation === "equal_gap_y") {
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
          relation,
          target: chain[j + 1],
          target2: chain[j + 2]
        };
        if (m) {
          rule.distancePx = +m[1];
        }
        rules.push(rule);
      }

      continue;
    }

    const target   = txt(node.childForFieldName("target"));
    const target2  = txt(node.childForFieldName("target2"));

    const rule: Rule = {
      element,
      relation,
      target,
      target2
    };
    if (m) {
      rule.distancePx = +m[1];
    }

    rules.push(rule);
  }

  return rules;
}
