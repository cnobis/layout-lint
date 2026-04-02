import type { Rule } from "./dsl.js";

function byId(name: string): HTMLElement | null {
  return document.getElementById(name);
}

const rect = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null);

function measureNearDirection(a: DOMRect, b: DOMRect, direction: string): number {
  switch (direction) {
    case "left":
      return Math.max(0, b.left - a.right);
    case "right":
      return Math.max(0, a.left - b.right);
    case "top":
      return Math.max(0, b.top - a.bottom);
    case "bottom":
      return Math.max(0, a.top - b.bottom);
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function evaluateRange(actual: number, min: number, max: number): { pass: boolean; deviation: number } {
  if (actual < min) return { pass: false, deviation: min - actual };
  if (actual > max) return { pass: false, deviation: actual - max };
  return { pass: true, deviation: 0 };
}

function evaluateRangeWithTolerance(
  actual: number,
  min: number,
  max: number,
  tolerance = 0.5
): { pass: boolean; deviation: number } {
  const minWithTolerance = min - tolerance;
  const maxWithTolerance = max + tolerance;
  if (actual < minWithTolerance) return { pass: false, deviation: min - actual };
  if (actual > maxWithTolerance) return { pass: false, deviation: actual - max };
  return { pass: true, deviation: 0 };
}

function evaluateNearClauseDistance(
  actual: number,
  clause: { distancePx?: number; distanceMinPx?: number; distanceMaxPx?: number }
): { pass: boolean; deviation: number } {
  if (clause.distanceMinPx != null && clause.distanceMaxPx != null) {
    return evaluateRangeWithTolerance(actual, clause.distanceMinPx, clause.distanceMaxPx, 0.5);
  }

  const expected = clause.distancePx ?? 0;
  const deviation = Math.abs(actual - expected);
  return { pass: deviation <= 1, deviation };
}

function measureSize(rect: DOMRect, property: "width" | "height"): number {
  return property === "width"
    ? Math.max(0, rect.right - rect.left)
    : Math.max(0, rect.bottom - rect.top);
}

function evaluateSizeConstraint(rule: Rule, actual: number, unit: "px" | "%"): boolean {
  const exact = unit === "px" ? rule.distancePx : rule.distancePct;
  const min = unit === "px" ? rule.distanceMinPx : rule.distanceMinPct;
  const max = unit === "px" ? rule.distanceMaxPx : rule.distanceMaxPct;

  if (rule.comparator && exact != null) {
    switch (rule.comparator) {
      case "<":
        return actual < exact;
      case "<=":
        return actual <= exact;
      case ">":
        return actual > exact;
      case ">=":
        return actual >= exact;
      default:
        return false;
    }
  }

  if (min != null && max != null) {
    return actual >= min && actual <= max;
  }

  if (exact != null) {
    return Math.abs(actual - exact) <= 1;
  }

  return false;
}

function isFullyInside(elementRect: DOMRect, containerRect: DOMRect): boolean {
  return (
    elementRect.left >= containerRect.left &&
    elementRect.right <= containerRect.right &&
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom
  );
}

function isOverlapping(elementRect: DOMRect, containerRect: DOMRect): boolean {
  return (
    elementRect.left < containerRect.right &&
    elementRect.right > containerRect.left &&
    elementRect.top < containerRect.bottom &&
    elementRect.bottom > containerRect.top
  );
}

function measureInsideOffset(elementRect: DOMRect, containerRect: DOMRect, side: string): number {
  switch (side) {
    case "left":
      return elementRect.left - containerRect.left;
    case "right":
      return containerRect.right - elementRect.right;
    case "top":
      return elementRect.top - containerRect.top;
    case "bottom":
      return containerRect.bottom - elementRect.bottom;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function measure(relation: string, a: HTMLElement | null, b: HTMLElement | null, c: HTMLElement | null): number | null {
  // absolute rules don't need a target element
  const isAbsolute = ["distance-from-top"].includes(relation);
  const isTernary = ["equal-gap-x", "equal-gap-y"].includes(relation);
  
  const A = rect(a);
  if (!A) return null;  // always need the main element
  
  // for absolute rules, return early without checking B
  if (isAbsolute) {
    switch (relation) {
      case "distance-from-top": return A.top;
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
      case "equal-gap-x": {
        const gap1 = B.left - A.right;
        const gap2 = C.left - B.right;
        return Math.abs(gap1 - gap2);
      }
      case "equal-gap-y": {
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
    case "right-of":      return A.left - B.right;
    case "left-of":       return B.left - A.right;
    case "centered-x":    return Math.abs(((A.left + A.right) / 2) - ((B.left + B.right) / 2));
    case "centered-y":    return Math.abs(((A.top + A.bottom) / 2) - ((B.top + B.bottom) / 2));
    case "aligned-top":   return Math.abs(A.top    - B.top);
    case "aligned-bottom": return Math.abs(A.bottom - B.bottom);
    case "aligned-left":  return Math.abs(A.left   - B.left);
    case "aligned-right": return Math.abs(A.right  - B.right);
    case "wider-than":    return (A.right - A.left) - (B.right - B.left);
    case "taller-than":   return (A.bottom - A.top) - (B.bottom - B.top);
    case "same-width":    return Math.abs((A.right - A.left) - (B.right - B.left));
    case "same-height":   return Math.abs((A.bottom - A.top) - (B.bottom - B.top));
    default:              return null;
  }
}

export interface RuleResult extends Rule {
  actual: number | string | null;
  pass: boolean;
  reason?: string;
}

function normalizeVisibleText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function getElementVisibleText(element: HTMLElement): string {
  const rawText = typeof (element as any).innerText === "string"
    ? (element as any).innerText
    : (element.textContent ?? "");
  return normalizeVisibleText(rawText);
}

function applyTextOperations(text: string, operations: Array<"lowercase" | "uppercase" | "singleline">): string {
  let next = text;
  for (const operation of operations) {
    if (operation === "lowercase") {
      next = next.toLowerCase();
      continue;
    }
    if (operation === "uppercase") {
      next = next.toUpperCase();
      continue;
    }
    if (operation === "singleline") {
      next = next.replace(/[\r\n]+/g, " ");
    }
  }
  return next;
}

function evaluateStringConstraint(
  relation: string,
  prefix: "text-" | "css-",
  actual: string,
  expected: string
): { pass: boolean; reason?: string } {
  const mode = relation.slice(prefix.length);
  switch (mode) {
    case "is":
      return { pass: actual === expected };
    case "contains":
      return { pass: actual.includes(expected) };
    case "starts":
      return { pass: actual.startsWith(expected) };
    case "ends":
      return { pass: actual.endsWith(expected) };
    case "matches":
      try {
        return { pass: new RegExp(expected).test(actual) };
      } catch {
        return { pass: false, reason: `Invalid regular expression: ${expected}` };
      }
    default:
      return { pass: false, reason: `Unsupported relation: ${relation}` };
  }
}

function getComputedStyleObject(element: HTMLElement): CSSStyleDeclaration | null {
  const view = element.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
  if (view && typeof view.getComputedStyle === "function") {
    return view.getComputedStyle(element);
  }
  if (typeof globalThis.getComputedStyle === "function") {
    return globalThis.getComputedStyle(element);
  }
  return null;
}

function toCamelCaseCssProperty(property: string): string {
  return property.replace(/-([a-z])/g, (_, next: string) => next.toUpperCase());
}

function getElementComputedCssValue(element: HTMLElement, property: string): string {
  const style = getComputedStyleObject(element);
  if (!style) return "";

  const normalizedProperty = property.trim().toLowerCase();
  const directValue = style.getPropertyValue(normalizedProperty);
  if (directValue) return normalizeVisibleText(directValue);

  const camelCaseProperty = toCamelCaseCssProperty(normalizedProperty);
  const fallbackValue = (style as any)[camelCaseProperty];
  return typeof fallbackValue === "string" ? normalizeVisibleText(fallbackValue) : "";
}

function isElementVisible(element: HTMLElement): boolean {
  const style = getComputedStyleObject(element);
  if (style) {
    if (style.display === "none") return false;
    if (style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (style.opacity === "0") return false;
  }

  const bounds = rect(element);
  if (!bounds) return false;
  return bounds.width > 0 && bounds.height > 0;
}

function toPatternRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/#/g, "\\d+");
  return new RegExp(`^${escaped}$`);
}

function collectPatternMatches(pattern: string): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const matcher = toPatternRegex(pattern);
  const nodes = Array.from(document.querySelectorAll("[id]"));
  return nodes
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .filter((node) => matcher.test(node.id));
}

function evaluateCountConstraint(rule: Rule, actual: number): boolean {
  const expected = rule.countExpected;
  const min = rule.countMin;
  const max = rule.countMax;

  if (rule.comparator && expected != null) {
    switch (rule.comparator) {
      case "<":
        return actual < expected;
      case "<=":
        return actual <= expected;
      case ">":
        return actual > expected;
      case ">=":
        return actual >= expected;
      default:
        return false;
    }
  }

  if (min != null && max != null) {
    return actual >= min && actual <= max;
  }

  if (expected != null) {
    return actual === expected;
  }

  return false;
}

export function evaluateRules(
  rules: Rule[],
  resolve: (id: string) => HTMLElement | null = byId,
  resolvePattern?: (pattern: string) => Array<HTMLElement | null>
): RuleResult[] {
  const applyNegation = (rule: Rule, pass: boolean): boolean => {
    return rule.negated ? !pass : pass;
  };

  return rules.map(r => {
    if (r.relation === "visible" || r.relation === "absent") {
      const element = resolve(r.element);
      const visible = !!element && isElementVisible(element);
      const basePass = r.relation === "visible" ? visible : !visible;
      return {
        ...r,
        actual: visible ? 1 : 0,
        pass: applyNegation(r, basePass),
        reason: !element && r.relation === "visible" ? `Element not found: ${r.element}` : undefined,
      };
    }

    if (r.relation.startsWith("count-")) {
      if (!r.countPattern) {
        return { ...r, pass: false, actual: null, reason: "Missing count pattern in rule" };
      }

      const matches = resolvePattern
        ? resolvePattern(r.countPattern)
        : collectPatternMatches(r.countPattern);

      const scope = r.relation.slice("count-".length);
      const actualCount = scope === "visible"
        ? matches.filter((element): element is HTMLElement => !!element && isElementVisible(element)).length
        : scope === "absent"
          ? matches.filter((element) => !element || !isElementVisible(element as HTMLElement)).length
          : matches.filter(Boolean).length;

      const pass = evaluateCountConstraint(r, actualCount);
      return { ...r, actual: actualCount, pass: applyNegation(r, pass) };
    }

    if (r.relation.startsWith("text-")) {
      const element = resolve(r.element);
      if (!element) {
        return { ...r, pass: false, actual: null, reason: `Element not found: ${r.element}` };
      }

      const operations = r.textOperations ?? [];
      const actualText = applyTextOperations(getElementVisibleText(element), operations);
      const expectedText = normalizeVisibleText(r.textExpected ?? "");
      const evaluation = evaluateStringConstraint(r.relation, "text-", actualText, expectedText);
      return {
        ...r,
        actual: actualText,
        pass: applyNegation(r, evaluation.pass),
        reason: evaluation.reason,
      };
    }

    if (r.relation.startsWith("css-")) {
      const element = resolve(r.element);
      if (!element) {
        return { ...r, pass: false, actual: null, reason: `Element not found: ${r.element}` };
      }

      if (!r.cssProperty) {
        return { ...r, pass: false, actual: null, reason: "Missing css property in rule" };
      }

      const actualCssValue = getElementComputedCssValue(element, r.cssProperty);
      const expectedCssValue = normalizeVisibleText(r.cssExpected ?? "");
      const evaluation = evaluateStringConstraint(r.relation, "css-", actualCssValue, expectedCssValue);
      return {
        ...r,
        actual: actualCssValue,
        pass: applyNegation(r, evaluation.pass),
        reason: evaluation.reason,
      };
    }

    if (r.relation === "width" || r.relation === "height") {
      const element = resolve(r.element);
      if (!element) {
        return { ...r, pass: false, actual: null, reason: `Element not found: ${r.element}` };
      }

      const elementRect = rect(element)!;
      const elementSize = measureSize(elementRect, r.relation as "width" | "height");

      const isPercentRule =
        r.distancePct != null ||
        r.distanceMinPct != null ||
        r.distanceMaxPct != null;

      if (isPercentRule) {
        const target = r.target ? resolve(r.target) : null;
        if (!target) {
          const missing = r.target || "unknown";
          return { ...r, pass: false, actual: null, reason: `Element not found: ${missing}` };
        }

        const targetRect = rect(target)!;
        const targetProperty = r.targetProperty ?? "width";
        const targetSize = measureSize(targetRect, targetProperty);
        if (targetSize <= 0) {
          return { ...r, pass: false, actual: null, reason: `Invalid target size for: ${r.target}` };
        }

        const actualPct = (elementSize / targetSize) * 100;
        const pass = evaluateSizeConstraint(r, actualPct, "%");
        return { ...r, actual: actualPct, pass: applyNegation(r, pass) };
      }

      const pass = evaluateSizeConstraint(r, elementSize, "px");
      return { ...r, actual: elementSize, pass: applyNegation(r, pass) };
    }

    if ((r.relation === "inside" || r.relation === "partially-inside")) {
      const element = resolve(r.element);
      const container = r.target ? resolve(r.target) : null;

      if (!element || !container) {
        const missing = !element ? r.element : r.target || "unknown";
        return { ...r, pass: false, actual: null, reason: `Element not found: ${missing}` };
      }

      const elementRect = rect(element)!;
      const containerRect = rect(container)!;
      const offsets = r.insideOffsets ?? [];

      if (offsets.length === 0) {
        if (r.relation === "inside") {
          const pass = isFullyInside(elementRect, containerRect);
          return { ...r, pass: applyNegation(r, pass), actual: pass ? 0 : 1000 };
        }

        const pass = isOverlapping(elementRect, containerRect);
        return { ...r, pass: applyNegation(r, pass), actual: pass ? 0 : 1000 };
      }

      let maxDeviation = 0;
      let firstMeasuredOffset: number | null = null;
      let pass = true;

      for (const clause of offsets) {
        for (const side of clause.sides) {
          const actualOffset = measureInsideOffset(elementRect, containerRect, side);
          if (firstMeasuredOffset == null) firstMeasuredOffset = actualOffset;
          const deviation = Math.abs(actualOffset - clause.offsetPx);
          maxDeviation = Math.max(maxDeviation, deviation);
          if (deviation > 1) {
            pass = false;
          }
        }
      }

      if (r.relation === "inside" && !isFullyInside(elementRect, containerRect)) {
        pass = false;
      }

      const actualValue = pass ? (firstMeasuredOffset ?? 0) : maxDeviation;
      return { ...r, pass: applyNegation(r, pass), actual: actualValue };
    }

    // Handle near relations specially
    if (r.relation === "near" && r.nearDirections) {
      const a = resolve(r.element);
      const b = r.target ? resolve(r.target) : null;
      
      if (!a || !b) {
        const missing = !a ? r.element : r.target || "unknown";
        return { ...r, pass: false, actual: null, reason: `Element not found: ${missing}` };
      }
      
      const A = rect(a)!;
      const B = rect(b)!;
      
      // Check all near clauses
      let maxDeviation = 0;
      let firstMeasuredDistance: number | null = null;
      let pass = true;
      
      for (const clause of r.nearDirections) {
        for (const direction of clause.directions) {
          const actual = measureNearDirection(A, B, direction);
          if (firstMeasuredDistance == null) {
            firstMeasuredDistance = actual;
          }
          const result = evaluateNearClauseDistance(actual, clause);
          maxDeviation = Math.max(maxDeviation, result.deviation);
          if (!result.pass) {
            pass = false;
          }
        }
      }

      const actualValue = pass
        ? (firstMeasuredDistance ?? 0)
        : maxDeviation;

      return { ...r, actual: actualValue, pass: applyNegation(r, pass) };
    }
    
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
      r.relation.startsWith("aligned-") ||
      r.relation === "centered-x" ||
      r.relation === "centered-y";
    const isEqualGap = r.relation === "equal-gap-x" || r.relation === "equal-gap-y";
    const hasRange = r.distanceMinPx != null && r.distanceMaxPx != null;
    let pass: boolean;
    if (isAlignment) {
      if (hasRange) {
        pass = d >= (r.distanceMinPx as number) && d <= (r.distanceMaxPx as number);
      } else if (r.distancePx != null) {
        pass = Math.abs(d - r.distancePx) <= 1;
      } else {
        pass = d <= 1;
      }
    } else if (isEqualGap) {
      if (hasRange) {
        pass = d >= (r.distanceMinPx as number) && d <= (r.distanceMaxPx as number);
      } else {
        pass = d <= (r.distancePx ?? 1);
      }
    } else {
      if (hasRange) {
        pass = d >= (r.distanceMinPx as number) && d <= (r.distanceMaxPx as number);
      } else {
        pass = d >= (r.distancePx ?? 0);
      }
    }
    return { ...r, actual: d, pass: applyNegation(r, pass) };
  });
}
