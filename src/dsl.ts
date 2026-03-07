import type { Tree } from "web-tree-sitter";

export interface Rule {
  element: string;
  relation: string;
  target?: string;  // optional for absolute rules like distance_from_top
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
    const target   = txt(node.childForFieldName("target"));
    const distTok  = txt(node.childForFieldName("distance")); // e.g. "20px"
    const m = distTok.match(/^(\d+)px$/);

    const rule: Rule = {
      element,
      relation,
      target
    };
    if (m) {
      rule.distancePx = +m[1];
    }

    rules.push(rule);
  }

  return rules;
}
