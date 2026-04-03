import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseQuotedTextToken,
  parseSignedDistanceToken,
  mapAlignedRelations,
  mapCenteredRelations,
  buildCountRule,
  buildCssRule,
  buildTextRule,
  buildEqualGapRules,
  detectInsideRelation,
  isNearNode,
  buildSizeRule,
} from '../dist/core/dsl-helpers.js';

describe('dsl-helpers', () => {
  describe('token parsing', () => {
    it('parses quoted text with escapes and falls back gracefully', () => {
      assert.strictEqual(parseQuotedTextToken('"Hello\\nWorld"'), 'Hello\nWorld');
      assert.strictEqual(parseQuotedTextToken('"unclosed'), '"unclosed');
      assert.strictEqual(parseQuotedTextToken('plain'), 'plain');
    });

    it('parses signed px tokens', () => {
      assert.strictEqual(parseSignedDistanceToken('10px'), 10);
      assert.strictEqual(parseSignedDistanceToken('-20 px'), -20);
      assert.strictEqual(parseSignedDistanceToken('5%'), null);
    });
  });

  describe('relation mapping', () => {
    it('maps aligned axis/mode combinations', () => {
      assert.deepStrictEqual(mapAlignedRelations('horizontally', 'all'), ['aligned-top', 'aligned-bottom']);
      assert.deepStrictEqual(mapAlignedRelations('vertically', 'centered'), ['centered-x']);
      assert.deepStrictEqual(mapAlignedRelations('unknown', 'mode'), []);
    });

    it('maps centered axis values', () => {
      assert.deepStrictEqual(mapCenteredRelations('horizontally'), ['centered-x']);
      assert.deepStrictEqual(mapCenteredRelations('all'), ['centered-x', 'centered-y']);
      assert.deepStrictEqual(mapCenteredRelations('unknown'), []);
    });
  });

  describe('rule builders', () => {
    it('builds count/css/text rules with normalized fields', () => {
      const countRule = buildCountRule('visible', 'row-*', '3', '', '', '>=' );
      assert.strictEqual(countRule.relation, 'count-visible');
      assert.strictEqual(countRule.countExpected, 3);
      assert.strictEqual(countRule.comparator, '>=');

      const cssRule = buildCssRule('title', false, 'FONT-SIZE', 'is', '"16px"');
      assert.strictEqual(cssRule.relation, 'css-is');
      assert.strictEqual(cssRule.cssProperty, 'font-size');
      assert.strictEqual(cssRule.cssExpected, '16px');

      const textRule = buildTextRule('title', true, 'contains', '"hello"', ['lowercase']);
      assert.strictEqual(textRule.relation, 'text-contains');
      assert.strictEqual(textRule.negated, true);
      assert.deepStrictEqual(textRule.textOperations, ['lowercase']);
    });

    it('builds equal-gap chain rules from direct and chain targets', () => {
      const node = {
        childForFieldName(name) {
          if (name === 'target') return { value: 'b' };
          if (name === 'target2') return { value: 'c' };
          return null;
        },
        childrenForFieldName(name) {
          if (name === 'chain_target') return [{ value: 'd' }];
          return [];
        },
      };
      const txt = (n) => (n ? n.value ?? '' : '');
      const rules = buildEqualGapRules('a', false, 'equal-gap-x', node, txt, { distancePx: 8 });

      assert.strictEqual(rules.length, 2);
      assert.deepStrictEqual(
        rules.map((r) => [r.element, r.target, r.target2]),
        [
          ['a', 'b', 'c'],
          ['b', 'c', 'd'],
        ]
      );
      assert.ok(rules.every((r) => r.distancePx === 8));
    });

    it('builds size rule using injected token parsers', () => {
      const parseDistance = (token) => ({ distancePx: Number(token.replace(/\D/g, '')) });
      const parsePercentage = (token) => ({ distancePct: Number(token.replace(/\D/g, '')) });

      const pxRule = buildSizeRule(
        'card',
        false,
        'width',
        '<=',
        'main',
        'height',
        '200px',
        '',
        parseDistance,
        parsePercentage
      );

      assert.strictEqual(pxRule.distancePx, 200);
      assert.strictEqual(pxRule.comparator, '<=');
      assert.strictEqual(pxRule.targetProperty, 'height');

      const pctRule = buildSizeRule(
        'card',
        true,
        'height',
        '',
        'main',
        'width',
        '',
        '75%',
        parseDistance,
        parsePercentage
      );

      assert.strictEqual(pctRule.distancePct, 75);
      assert.strictEqual(pctRule.negated, true);
    });
  });

  describe('node relation detection', () => {
    it('detects inside and partially-inside variants', () => {
      assert.strictEqual(
        detectInsideRelation({ text: 'a inside b' }, 'inside'),
        'inside'
      );
      assert.strictEqual(
        detectInsideRelation({ text: 'a partially inside b' }, ''),
        'partially-inside'
      );
      assert.strictEqual(
        detectInsideRelation({ text: 'a below b' }, 'below'),
        null
      );
    });

    it('detects near node by field or token position', () => {
      const byField = {
        childForFieldName(name) {
          return name === 'near' ? {} : null;
        },
        childCount: 0,
        child() {
          return null;
        },
      };
      assert.strictEqual(isNearNode(byField), true);

      const byToken = {
        childForFieldName() {
          return null;
        },
        childCount: 2,
        child(index) {
          return index === 1 ? { text: 'near' } : null;
        },
      };
      assert.strictEqual(isNearNode(byToken), true);

      const noNear = {
        childForFieldName() {
          return null;
        },
        childCount: 2,
        child() {
          return { text: 'below' };
        },
      };
      assert.strictEqual(isNearNode(noNear), false);
    });
  });
});
