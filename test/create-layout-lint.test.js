import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createLayoutLint, formatDiagnostic, explainCode } from '../dist/index.js';

describe('createLayoutLint factory', () => {
  it('throws when called without options', () => {
    assert.throws(() => createLayoutLint(undefined), /options object/);
  });

  it('accepts options without wasmUrl (zero-config uses inlined WASM)', () => {
    const lint = createLayoutLint({ specText: 'nav above header' });
    assert.strictEqual(lint.getSpecText(), 'nav above header');
  });

  it('exposes spec accessors that round-trip', () => {
    const lint = createLayoutLint({ specText: 'nav above header', wasmUrl: 'x.wasm' });
    assert.strictEqual(lint.getSpecText(), 'nav above header');
    lint.setSpecText('footer below content');
    assert.strictEqual(lint.getSpecText(), 'footer below content');
  });

  it('formatDiagnostics renders each diagnostic against the current spec', () => {
    const lint = createLayoutLint({ specText: 'nav abav header', wasmUrl: 'x.wasm' });
    const diag = {
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'unexpected token',
      range: {
        startIndex: 4,
        endIndex: 8,
        start: { line: 1, column: 4 },
        end: { line: 1, column: 8 },
      },
      snippet: 'abav',
      primaryLabel: 'unexpected token',
      hint: 'did you mean `above`?',
    };
    const out = lint.formatDiagnostics([diag], { color: false });
    assert.match(out, /error\[LL-PARSE-SYNTAX\]/);
    assert.match(out, /did you mean `above`\?/);
  });

  it('formatDiagnostics joins multiple diagnostics with a blank line', () => {
    const lint = createLayoutLint({ specText: 'a\nb', wasmUrl: 'x.wasm' });
    const mk = (line) => ({
      code: 'LL-PARSE-SYNTAX',
      severity: 'error',
      message: 'm',
      range: {
        startIndex: line === 1 ? 0 : 2,
        endIndex: line === 1 ? 1 : 3,
        start: { line, column: 0 },
        end: { line, column: 1 },
      },
      snippet: line === 1 ? 'a' : 'b',
    });
    const out = lint.formatDiagnostics([mk(1), mk(2)], { color: false });
    assert.strictEqual(out.split(/\n\n/).length, 2);
  });

  it('explain returns the catalogue entry for a known code', () => {
    const lint = createLayoutLint({ specText: '', wasmUrl: 'x.wasm' });
    const text = lint.explain('LL-PARSE-SYNTAX');
    assert.ok(text && text.length > 0);
    assert.strictEqual(text, explainCode('LL-PARSE-SYNTAX').explain);
  });

  it('explain returns undefined for an unknown code', () => {
    const lint = createLayoutLint({ specText: '', wasmUrl: 'x.wasm' });
    assert.strictEqual(lint.explain('LL-UNKNOWN'), undefined);
  });

  it('re-exports formatDiagnostic for direct use', () => {
    assert.strictEqual(typeof formatDiagnostic, 'function');
  });
});
