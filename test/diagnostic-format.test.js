import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatDiagnostic } from '../dist/core/diagnostic-format.js';
import { explainCode, DIAGNOSTIC_CATALOGUE } from '../dist/core/diagnostic-codes.js';

const makeRange = (source, startIndex, endIndex) => {
  let line = 1;
  let column = 0;
  let startPos = null;
  let endPos = null;
  for (let i = 0; i <= source.length; i += 1) {
    if (i === startIndex) startPos = { line, column };
    if (i === endIndex) endPos = { line, column };
    if (i < source.length && source.charCodeAt(i) === 10) {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return { startIndex, endIndex, start: startPos, end: endPos };
};

describe('formatDiagnostic', () => {
  it('renders a primary span with a gutter and underline', () => {
    const source = 'nav above\nfooter below content';
    const range = makeRange(source, 4, 9); // "above"
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'Invalid spec syntax near this segment.',
      range,
      primaryLabel: 'unexpected token',
    };
    const out = formatDiagnostic(diag, source);
    assert.match(out, /^error\[LL-PARSE-SYNTAX\]: Invalid/);
    assert.match(out, /1 \| nav above/);
    assert.match(out, /\^\^\^\^\^/);
    assert.match(out, /unexpected token/);
  });

  it('includes a hint line when hint is set', () => {
    const source = 'nav abov header';
    const range = makeRange(source, 4, 8);
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'Invalid keyword.',
      range,
      hint: 'did you mean `above`?',
    };
    const out = formatDiagnostic(diag, source);
    assert.match(out, /= hint: did you mean `above`\?/);
  });

  it('falls back to legacy suggestion when hint is absent', () => {
    const source = 'nav abov header';
    const range = makeRange(source, 4, 8);
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'Invalid keyword.',
      range,
      suggestion: 'above',
    };
    const out = formatDiagnostic(diag, source);
    assert.match(out, /did you mean `above`\?/);
  });

  it('renders secondary spans with dashes', () => {
    const source = 'define cards as ".card"\ncount cards.* equals 3';
    const primary = makeRange(source, 30, 38); // "cards.*"
    const secondary = makeRange(source, 7, 12); // "cards"
    const diag = {
      code: 'LL-SEMANTIC-UNKNOWN-GROUP',
      severity: 'error',
      message: 'Group `cards.*` is not defined.',
      range: primary,
      primaryLabel: 'unknown group',
      secondarySpans: [{ range: secondary, label: 'a similar name is defined here' }],
    };
    const out = formatDiagnostic(diag, source);
    assert.match(out, /1 \| define cards as ".card"/);
    assert.match(out, /2 \| count cards\.\* equals 3/);
    assert.match(out, /----/); // secondary underline
    assert.match(out, /\^\^\^/); // primary underline
  });

  it('appends explanation when includeExplain is true', () => {
    const source = 'nav above';
    const range = makeRange(source, 0, 3);
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'Invalid.',
      range,
    };
    const out = formatDiagnostic(diag, source, { includeExplain: true });
    assert.match(out, /Invalid spec syntax/);
  });

  it('renders a fix line', () => {
    const source = 'nav abov header';
    const range = makeRange(source, 4, 8);
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'Invalid keyword.',
      range,
      fix: { range, replacement: 'above' },
    };
    const out = formatDiagnostic(diag, source);
    assert.match(out, /= fix: replace with `above`/);
  });
});

describe('DIAGNOSTIC_CATALOGUE', () => {
  it('exposes the known codes', () => {
    const required = [
      'LL-PARSE-SYNTAX',
      'LL-PARSE-MISSING',
      'LL-RULE-MALFORMED',
      'LL-SEMANTIC-UNKNOWN-GROUP',
      'LL-SEMANTIC-ELEMENT-NOT-FOUND',
    ];
    for (const code of required) {
      assert.ok(DIAGNOSTIC_CATALOGUE[code], `missing catalogue entry for ${code}`);
      const expl = explainCode(code);
      assert.ok(expl && expl.title && expl.explain, `incomplete entry for ${code}`);
    }
  });

  it('returns undefined for unknown codes', () => {
    assert.strictEqual(explainCode('LL-DOES-NOT-EXIST'), undefined);
  });
});
