import type { Rule, RuleResult } from "./types.js";
import {
  applyTextOperations,
  collectPatternMatches,
  computeCountForScope,
  evaluateCountConstraint,
  evaluateInsideOffsets,
  evaluateMeasuredRulePass,
  evaluateNearDirections,
  evaluateSizeConstraint,
  evaluateStringConstraint,
  getElementComputedCssValue,
  getElementVisibleText,
  isElementVisible,
  measure,
  measureSize,
  normalizeVisibleText,
  rect,
} from "./evaluator-helpers.js";

function byId(name: string): HTMLElement | null {
  return document.getElementById(name);
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
      const actualCount = computeCountForScope(scope, matches);

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
        const missing = [!element ? r.element : null, r.target && !container ? r.target : null].filter(Boolean).join(", ");
        return { ...r, pass: false, actual: null, reason: `Element not found: ${missing}` };
      }

      const elementRect = rect(element)!;
      const containerRect = rect(container)!;
      const offsets = r.insideOffsets ?? [];
      const evaluation = evaluateInsideOffsets(
        r.relation as "inside" | "partially-inside",
        elementRect,
        containerRect,
        offsets
      );
      return { ...r, pass: applyNegation(r, evaluation.pass), actual: evaluation.actual };
    }

    if (r.relation === "near" && r.nearDirections) {
      const a = resolve(r.element);
      const b = r.target ? resolve(r.target) : null;
      
      if (!a || !b) {
        const missing = [!a ? r.element : null, r.target && !b ? r.target : null].filter(Boolean).join(", ");
        return { ...r, pass: false, actual: null, reason: `Element not found: ${missing}` };
      }
      
      const A = rect(a)!;
      const B = rect(b)!;
      const evaluation = evaluateNearDirections(A, B, r.nearDirections);
      return { ...r, actual: evaluation.actual, pass: applyNegation(r, evaluation.pass) };
    }
    
    const a = resolve(r.element);
    const b = r.target ? resolve(r.target) : null;
    const c = r.target2 ? resolve(r.target2) : null;
    const d = measure(r.relation, a, b, c);
    if (d == null) {
      const missing = [!a ? r.element : null, r.target && !b ? r.target : null, r.target2 && !c ? r.target2 : null].filter(Boolean).join(", ");
      return { ...r, pass: false, actual: null, reason: missing ? `Element not found: ${missing}` : undefined };
    }
    const pass = evaluateMeasuredRulePass(r, d);
    return { ...r, actual: d, pass: applyNegation(r, pass) };
  });
}
