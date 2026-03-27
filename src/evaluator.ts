import type { Rule } from "./dsl.js";

function byId(name: string): HTMLElement | null {
  return document.getElementById(name);
}

const rect = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null);

function measure(relation: string, a: HTMLElement | null, b: HTMLElement | null, c: HTMLElement | null): number | null {
  // absolute rules don't need a target element
  const isAbsolute = ["distance_from_top"].includes(relation);
  const isTernary = ["equal_gap_x", "equal_gap_y"].includes(relation);
  
  const A = rect(a);
  if (!A) return null;  // always need the main element
  
  // for absolute rules, return early without checking B
  if (isAbsolute) {
    switch (relation) {
      case "distance_from_top": return A.top;
      default: return null;
    }
  }
  
  // for relative rules, B is required
  const B = rect(b);
  if (!B) return null;

  if (isTernary) {
    const C = rect(c);
    if (!C) return null;

    switch (relation) {
      case "equal_gap_x": {
        const gap1 = B.left - A.right;
        const gap2 = C.left - B.right;
        return Math.abs(gap1 - gap2);
      }
      case "equal_gap_y": {
        const gap1 = B.top - A.bottom;
        const gap2 = C.top - B.bottom;
        return Math.abs(gap1 - gap2);
      }
      default:
        return null;
    }
  }
  
  switch (relation) {
    case "below":         return A.top  - B.bottom;
    case "above":         return B.top  - A.bottom;
    case "right_of":      return A.left - B.right;
    case "left_of":       return B.left - A.right;
    case "centered_x":    return Math.abs(((A.left + A.right) / 2) - ((B.left + B.right) / 2));
    case "centered_y":    return Math.abs(((A.top + A.bottom) / 2) - ((B.top + B.bottom) / 2));
    case "aligned_top":   return Math.abs(A.top    - B.top);
    case "aligned_bottom": return Math.abs(A.bottom - B.bottom);
    case "aligned_left":  return Math.abs(A.left   - B.left);
    case "aligned_right": return Math.abs(A.right  - B.right);
    case "contains":      return (A.left <= B.left && A.right >= B.right && A.top <= B.top && A.bottom >= B.bottom) ? 0 : 1000;
    case "wider_than":    return (A.right - A.left) - (B.right - B.left);
    case "taller_than":   return (A.bottom - A.top) - (B.bottom - B.top);
    case "same_width":    return Math.abs((A.right - A.left) - (B.right - B.left));
    case "same_height":   return Math.abs((A.bottom - A.top) - (B.bottom - B.top));
    case "overlaps":      return (A.left < B.right && A.right > B.left && A.top < B.bottom && A.bottom > B.top) ? 0 : 1000;
    default:              return null;
  }
}

export interface RuleResult extends Rule {
  actual: number | null;
  pass: boolean;
  reason?: string;
}

export function evaluateRules(rules: Rule[], resolve: (id: string) => HTMLElement | null = byId): RuleResult[] {
  return rules.map(r => {
    const a = resolve(r.element);
    // only resolve target if it exists (absolute rules don't have targets)
    const b = r.target ? resolve(r.target) : null;
    const c = r.target2 ? resolve(r.target2) : null;
    const d = measure(r.relation, a, b, c);
    if (d == null) {
      const missing = !a
        ? r.element
        : (!b && r.target
            ? r.target
            : (!c && r.target2
                ? r.target2
                : "unknown"));
      return { ...r, pass: false, actual: null, reason: !a ? `Element not found: ${missing}` : undefined };
    }
    // for alignment relations (no distancePx), use 1px tolerance
    const isAlignment =
      r.relation.startsWith("aligned_") ||
      r.relation === "centered_x" ||
      r.relation === "centered_y";
    const isEqualGap = r.relation === "equal_gap_x" || r.relation === "equal_gap_y";
    const isSemantic = ["contains", "overlaps"].includes(r.relation);
    let pass: boolean;
    if (isAlignment) {
      pass = d <= 1;
    } else if (isEqualGap) {
      pass = d <= (r.distancePx ?? 1);
    } else if (isSemantic) {
      // semantic relations pass only when d === 0
      pass = d === 0;
    } else {
      pass = d >= (r.distancePx ?? 0);
    }
    return { ...r, actual: d, pass };
  });
}
