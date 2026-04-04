import type { Rule } from "./types.js";

type ElementTextLike = HTMLElement & {
  innerText?: string;
};

interface CssStyleWithIndex extends CSSStyleDeclaration {
  [key: string]: unknown;
}

export const rect = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null);

export function measureNearDirection(a: DOMRect, b: DOMRect, direction: string): number {
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

export function evaluateNearClauseDistance(
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

export function measureSize(rectangle: DOMRect, property: "width" | "height"): number {
  return property === "width"
    ? Math.max(0, rectangle.right - rectangle.left)
    : Math.max(0, rectangle.bottom - rectangle.top);
}

export function evaluateSizeConstraint(rule: Rule, actual: number, unit: "px" | "%"): boolean {
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

export function isFullyInside(elementRect: DOMRect, containerRect: DOMRect): boolean {
  return (
    elementRect.left >= containerRect.left &&
    elementRect.right <= containerRect.right &&
    elementRect.top >= containerRect.top &&
    elementRect.bottom <= containerRect.bottom
  );
}

export function isOverlapping(elementRect: DOMRect, containerRect: DOMRect): boolean {
  return (
    elementRect.left < containerRect.right &&
    elementRect.right > containerRect.left &&
    elementRect.top < containerRect.bottom &&
    elementRect.bottom > containerRect.top
  );
}

export function measureInsideOffset(elementRect: DOMRect, containerRect: DOMRect, side: string): number {
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

export function measure(relation: string, a: HTMLElement | null, b: HTMLElement | null, c: HTMLElement | null): number | null {
  const isAbsolute = ["distance-from-top"].includes(relation);
  const isTernary = ["equal-gap-x", "equal-gap-y"].includes(relation);

  const A = rect(a);
  if (!A) return null;

  if (isAbsolute) {
    switch (relation) {
      case "distance-from-top": return A.top;
      default: return null;
    }
  }

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

export function normalizeVisibleText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function getElementVisibleText(element: HTMLElement): string {
  const textElement = element as ElementTextLike;
  const rawText = typeof textElement.innerText === "string"
    ? textElement.innerText
    : (element.textContent ?? "");
  return normalizeVisibleText(rawText);
}

export function applyTextOperations(text: string, operations: Array<"lowercase" | "uppercase" | "singleline">): string {
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

export function evaluateStringConstraint(
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

export function getElementComputedCssValue(element: HTMLElement, property: string): string {
  const style = getComputedStyleObject(element);
  if (!style) return "";

  const normalizedProperty = property.trim().toLowerCase();
  const directValue = style.getPropertyValue(normalizedProperty);
  if (directValue) return normalizeVisibleText(directValue);

  const camelCaseProperty = toCamelCaseCssProperty(normalizedProperty);
  const fallbackValue = (style as CssStyleWithIndex)[camelCaseProperty];
  return typeof fallbackValue === "string" ? normalizeVisibleText(fallbackValue) : "";
}

export function isElementVisible(element: HTMLElement): boolean {
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

export function collectPatternMatches(pattern: string): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const matcher = toPatternRegex(pattern);
  const nodes = Array.from(document.querySelectorAll("[id]"));
  return nodes
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .filter((node) => matcher.test(node.id));
}

export function evaluateCountConstraint(rule: Rule, actual: number): boolean {
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

export function computeCountForScope(
  scope: string,
  matches: Array<HTMLElement | null>
): number {
  if (scope === "visible") {
    return matches.filter((element): element is HTMLElement => !!element && isElementVisible(element)).length;
  }

  if (scope === "absent") {
    return matches.filter((element) => !element || !isElementVisible(element as HTMLElement)).length;
  }

  return matches.filter(Boolean).length;
}

export function evaluateInsideOffsets(
  relation: "inside" | "partially-inside",
  elementRect: DOMRect,
  containerRect: DOMRect,
  offsets: Array<{ sides: string[]; offsetPx: number }>
): { pass: boolean; actual: number } {
  if (offsets.length === 0) {
    if (relation === "inside") {
      const pass = isFullyInside(elementRect, containerRect);
      return { pass, actual: pass ? 0 : 1000 };
    }

    const pass = isOverlapping(elementRect, containerRect);
    return { pass, actual: pass ? 0 : 1000 };
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

  if (relation === "inside" && !isFullyInside(elementRect, containerRect)) {
    pass = false;
  }

  return {
    pass,
    actual: pass ? (firstMeasuredOffset ?? 0) : maxDeviation,
  };
}

export function evaluateNearDirections(
  a: DOMRect,
  b: DOMRect,
  nearDirections: Array<{
    directions: string[];
    distancePx?: number;
    distanceMinPx?: number;
    distanceMaxPx?: number;
  }>
): { pass: boolean; actual: number } {
  let maxDeviation = 0;
  let firstMeasuredDistance: number | null = null;
  let pass = true;

  for (const clause of nearDirections) {
    for (const direction of clause.directions) {
      const actual = measureNearDirection(a, b, direction);
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

  return {
    pass,
    actual: pass ? (firstMeasuredDistance ?? 0) : maxDeviation,
  };
}

export function evaluateMeasuredRulePass(rule: Rule, measured: number): boolean {
  const isAlignment =
    rule.relation.startsWith("aligned-") ||
    rule.relation === "centered-x" ||
    rule.relation === "centered-y";
  const isEqualGap = rule.relation === "equal-gap-x" || rule.relation === "equal-gap-y";
  const hasRange = rule.distanceMinPx != null && rule.distanceMaxPx != null;

  if (isAlignment) {
    if (hasRange) {
      return measured >= (rule.distanceMinPx as number) && measured <= (rule.distanceMaxPx as number);
    }
    if (rule.distancePx != null) {
      return Math.abs(measured - rule.distancePx) <= 1;
    }
    return measured <= 1;
  }

  if (isEqualGap) {
    if (hasRange) {
      return measured >= (rule.distanceMinPx as number) && measured <= (rule.distanceMaxPx as number);
    }
    return measured <= (rule.distancePx ?? 1);
  }

  if (hasRange) {
    return measured >= (rule.distanceMinPx as number) && measured <= (rule.distanceMaxPx as number);
  }
  return measured >= (rule.distancePx ?? 0);
}
