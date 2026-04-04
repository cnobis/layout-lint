import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeVisibleText,
  applyTextOperations,
  evaluateStringConstraint,
  evaluateNearClauseDistance,
  evaluateMeasuredRulePass,
  evaluateInsideOffsets,
  computeCountForScope,
  evaluateSizeConstraint,
  getElementComputedCssValue,
} from '../dist/core/evaluator-helpers.js';

describe('evaluator-helpers', () => {
  describe('text helpers', () => {
    it('normalizes visible text whitespace', () => {
      assert.strictEqual(normalizeVisibleText('  hello\n   world  '), 'hello world');
    });

    it('applies text operations in order', () => {
      const actual = applyTextOperations('Hello\nWorld', ['singleline', 'lowercase']);
      assert.strictEqual(actual, 'hello world');
    });

    it('evaluates string constraints including regex errors', () => {
      assert.strictEqual(evaluateStringConstraint('text-is', 'text-', 'abc', 'abc').pass, true);
      assert.strictEqual(evaluateStringConstraint('text-contains', 'text-', 'abc', 'b').pass, true);
      assert.strictEqual(evaluateStringConstraint('css-starts', 'css-', '10px', '10').pass, true);
      assert.strictEqual(evaluateStringConstraint('text-matches', 'text-', 'abc123', '^abc\\d+$').pass, true);

      const invalidRegex = evaluateStringConstraint('text-matches', 'text-', 'abc', '[');
      assert.strictEqual(invalidRegex.pass, false);
      assert.ok(invalidRegex.reason?.includes('Invalid regular expression'));
    });
  });

  describe('measurement/comparison helpers', () => {
    it('evaluates near clause exact and ranged distance with tolerance', () => {
      assert.strictEqual(evaluateNearClauseDistance(10, { distancePx: 10 }).pass, true);
      assert.strictEqual(evaluateNearClauseDistance(11, { distancePx: 10 }).pass, true);
      assert.strictEqual(evaluateNearClauseDistance(12.2, { distancePx: 10 }).pass, false);

      assert.strictEqual(
        evaluateNearClauseDistance(4.6, { distanceMinPx: 5, distanceMaxPx: 15 }).pass,
        true
      );
      assert.strictEqual(
        evaluateNearClauseDistance(15.6, { distanceMinPx: 5, distanceMaxPx: 15 }).pass,
        false
      );
    });

    it('evaluates measured rule pass by relation category', () => {
      assert.strictEqual(evaluateMeasuredRulePass({ relation: 'aligned-left' }, 0.8), true);
      assert.strictEqual(evaluateMeasuredRulePass({ relation: 'aligned-left', distancePx: 3 }, 2.2), true);
      assert.strictEqual(
        evaluateMeasuredRulePass({ relation: 'equal-gap-x', distanceMinPx: 5, distanceMaxPx: 10 }, 7),
        true
      );
      assert.strictEqual(
        evaluateMeasuredRulePass({ relation: 'below', distanceMinPx: 10, distanceMaxPx: 20 }, 25),
        false
      );
      assert.strictEqual(evaluateMeasuredRulePass({ relation: 'below', distancePx: 10 }, 12), true);
    });

    it('evaluates inside offsets with and without explicit clauses', () => {
      const container = { left: 0, top: 0, right: 200, bottom: 200 };
      const inside = { left: 10, top: 10, right: 100, bottom: 100 };
      const outside = { left: -5, top: 10, right: 100, bottom: 100 };

      const noClauseInside = evaluateInsideOffsets('inside', inside, container, []);
      assert.deepStrictEqual(noClauseInside, { pass: true, actual: 0 });

      const noClauseOutside = evaluateInsideOffsets('inside', outside, container, []);
      assert.strictEqual(noClauseOutside.pass, false);
      assert.strictEqual(noClauseOutside.actual, 1000);

      const withClauses = evaluateInsideOffsets('inside', inside, container, [
        { sides: ['left', 'top'], offsetPx: 10 },
      ]);
      assert.strictEqual(withClauses.pass, true);
      assert.strictEqual(withClauses.actual, 10);
    });

    it('evaluates size constraint for comparator, range, and exact', () => {
      assert.strictEqual(evaluateSizeConstraint({ comparator: '<', distancePx: 101 }, 100, 'px'), true);
      assert.strictEqual(evaluateSizeConstraint({ distanceMinPx: 95, distanceMaxPx: 100 }, 97, 'px'), true);
      assert.strictEqual(evaluateSizeConstraint({ distancePx: 100 }, 100.9, 'px'), true);

      assert.strictEqual(
        evaluateSizeConstraint({ distanceMinPct: 50, distanceMaxPct: 75 }, 80, '%'),
        false
      );
    });
  });

  describe('count and css helpers', () => {
    const visibleEl = {
      getBoundingClientRect: () => ({ width: 10, height: 10 }),
    };
    const hiddenEl = {
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
    };

    it('computes count by any/visible/absent scope', () => {
      const matches = [visibleEl, hiddenEl, null];
      assert.strictEqual(computeCountForScope('any', matches), 2);
      assert.strictEqual(computeCountForScope('visible', matches), 1);
      assert.strictEqual(computeCountForScope('absent', matches), 2);
    });

    it('reads computed css value with direct and camelCase fallback access', () => {
      const originalGetComputedStyle = globalThis.getComputedStyle;
      let useDirect = true;
      globalThis.getComputedStyle = () => ({
        getPropertyValue: (property) => (useDirect && property === 'font-size' ? '16px' : ''),
        fontSize: '16px',
      });

      const element = {
        ownerDocument: null,
      };

      assert.strictEqual(getElementComputedCssValue(element, 'font-size'), '16px');

      useDirect = false;
      assert.strictEqual(getElementComputedCssValue(element, 'font-size'), '16px');

      globalThis.getComputedStyle = originalGetComputedStyle;
    });
  });
});
