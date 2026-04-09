import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  findFirstDiff,
  indexToPoint,
  CAPTURE_CLASS,
} from '../dist/devtools/widget/tree-sitter-highlight.js';
import { HIGHLIGHTS_SCM } from '../dist/devtools/widget/highlight-query.js';

describe('tree-sitter-highlight helpers', () => {
  describe('findFirstDiff', () => {
    it('returns 0 for completely different strings', () => {
      assert.strictEqual(findFirstDiff('abc', 'xyz'), 0);
    });

    it('returns index of first difference', () => {
      assert.strictEqual(findFirstDiff('header below nav', 'header above nav'), 7);
    });

    it('returns length of shorter string when one is a prefix of the other', () => {
      assert.strictEqual(findFirstDiff('header', 'header below'), 6);
    });

    it('returns length for identical strings', () => {
      assert.strictEqual(findFirstDiff('same', 'same'), 4);
    });

    it('handles empty strings', () => {
      assert.strictEqual(findFirstDiff('', 'abc'), 0);
      assert.strictEqual(findFirstDiff('abc', ''), 0);
      assert.strictEqual(findFirstDiff('', ''), 0);
    });
  });

  describe('indexToPoint', () => {
    it('returns row 0 col N for single-line text', () => {
      assert.deepStrictEqual(indexToPoint('hello world', 5), { row: 0, column: 5 });
    });

    it('advances row after newlines', () => {
      const text = 'line1\nline2\nline3';
      // Index 6 = start of 'l' in 'line2' → row 1, col 0
      assert.deepStrictEqual(indexToPoint(text, 6), { row: 1, column: 0 });
      // Index 12 = start of 'l' in 'line3' → row 2, col 0
      assert.deepStrictEqual(indexToPoint(text, 12), { row: 2, column: 0 });
    });

    it('computes column correctly mid-line', () => {
      const text = 'abc\ndefgh';
      // Index 7 = 'g' in 'defgh' → row 1, col 3
      assert.deepStrictEqual(indexToPoint(text, 7), { row: 1, column: 3 });
    });

    it('handles index 0', () => {
      assert.deepStrictEqual(indexToPoint('anything', 0), { row: 0, column: 0 });
    });
  });

  describe('CAPTURE_CLASS mapping', () => {
    it('maps all expected capture names to CSS classes', () => {
      const expected = ['keyword', 'number', 'unit', 'variable', 'string', 'operator', 'property', 'punctuation', 'error'];
      for (const name of expected) {
        assert.ok(CAPTURE_CLASS[name], `missing class for capture @${name}`);
        assert.ok(CAPTURE_CLASS[name].startsWith('token '), `class for @${name} should start with "token "`);
      }
    });

    it('returns specific class names', () => {
      assert.strictEqual(CAPTURE_CLASS['keyword'], 'token keyword');
      assert.strictEqual(CAPTURE_CLASS['variable'], 'token variable');
      assert.strictEqual(CAPTURE_CLASS['string'], 'token string');
      assert.strictEqual(CAPTURE_CLASS['error'], 'token error');
    });
  });

  describe('HIGHLIGHTS_SCM query', () => {
    it('is a non-empty string', () => {
      assert.ok(typeof HIGHLIGHTS_SCM === 'string');
      assert.ok(HIGHLIGHTS_SCM.length > 100);
    });

    it('contains expected capture groups', () => {
      assert.ok(HIGHLIGHTS_SCM.includes('@keyword'));
      assert.ok(HIGHLIGHTS_SCM.includes('@number'));
      assert.ok(HIGHLIGHTS_SCM.includes('@variable'));
      assert.ok(HIGHLIGHTS_SCM.includes('@string'));
      assert.ok(HIGHLIGHTS_SCM.includes('@operator'));
      assert.ok(HIGHLIGHTS_SCM.includes('@property'));
      assert.ok(HIGHLIGHTS_SCM.includes('@punctuation'));
      assert.ok(HIGHLIGHTS_SCM.includes('@error'));
      assert.ok(HIGHLIGHTS_SCM.includes('@unit'));
    });

    it('references grammar node types from the DSL', () => {
      assert.ok(HIGHLIGHTS_SCM.includes('(relation)'));
      assert.ok(HIGHLIGHTS_SCM.includes('(identifier)'));
      assert.ok(HIGHLIGHTS_SCM.includes('(quoted_text)'));
      assert.ok(HIGHLIGHTS_SCM.includes('(comparator)'));
      assert.ok(HIGHLIGHTS_SCM.includes('(css_property)'));
      assert.ok(HIGHLIGHTS_SCM.includes('(ERROR)'));
    });
  });
});
