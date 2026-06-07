import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { createLayoutLint, runLayoutLint } from '../dist/index.js';

// Restore globalThis.document after each spec that touches it.
const ORIGINAL_DOCUMENT = globalThis.document;
after(() => {
  if (ORIGINAL_DOCUMENT === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = ORIGINAL_DOCUMENT;
  }
});

function installFakeDocument() {
  const doc = {
    getElementById(_id) { return null; },
    querySelector(_sel) { return null; },
    querySelectorAll(_sel) { return []; },
  };
  globalThis.document = doc;
  return doc;
}

describe('zero-config: inlined WASM', () => {
  it('createLayoutLint runs end-to-end with no wasmUrl and no locateFile', async () => {
    installFakeDocument();
    const lint = createLayoutLint({ specText: 'nav above header' });
    const { rules, results, diagnostics } = await lint.run();

    assert.strictEqual(rules.length, 1, 'expected one rule parsed from spec');
    assert.strictEqual(results.length, 1, 'expected one evaluation result');
    const parseErrors = (diagnostics ?? []).filter(d => d.code === 'LL-PARSE-SYNTAX');
    assert.strictEqual(parseErrors.length, 0, 'inlined grammar should parse valid spec without syntax errors');
  });

  it('runLayoutLint one-shot also works zero-config', async () => {
    installFakeDocument();
    const { rules } = await runLayoutLint({ specText: 'footer below content' });
    assert.strictEqual(rules.length, 1);
  });
});

describe('headless: dom option and missing document', () => {
  it('returns parse diagnostics with empty results when no DOM is available', async () => {
    if (ORIGINAL_DOCUMENT === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = undefined;
      delete globalThis.document;
    }

    const { rules, results, diagnostics } = await runLayoutLint({ specText: 'nav above header' });
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(results.length, 0, 'headless mode skips evaluation');
    assert.ok(Array.isArray(diagnostics));
  });

  it('accepts an explicit dom option and evaluates against it', async () => {
    if (ORIGINAL_DOCUMENT === undefined) {
      delete globalThis.document;
    }
    const synthetic = {
      getElementById(_id) { return null; },
      querySelector(_sel) { return null; },
      querySelectorAll(_sel) { return []; },
    };
    const { rules, results } = await runLayoutLint({
      specText: 'nav above header',
      dom: synthetic,
    });
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(results.length, 1, 'dom option should trigger evaluation');
  });
});
