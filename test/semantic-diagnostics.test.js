import { describe, it } from 'node:test';
import assert from 'node:assert';
import { collectSemanticDiagnostics } from '../dist/core/runtime.js';

describe('semantic diagnostics collection', () => {
  it('maps element-not-found reasons to semantic diagnostics with source ranges', () => {
    const diagnostics = collectSemanticDiagnostics([
      {
        element: 'nav',
        relation: 'below',
        target: 'header',
        pass: false,
        actual: null,
        reason: 'Element not found: header',
        sourceRange: {
          startIndex: 10,
          endIndex: 28,
          start: { line: 2, column: 4 },
          end: { line: 2, column: 22 },
        },
      },
    ]);

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-SEMANTIC-ELEMENT-NOT-FOUND');
    assert.strictEqual(diagnostics[0].message, 'Element not found: header');
    assert.strictEqual(diagnostics[0].range.start.line, 2);
    assert.strictEqual(diagnostics[0].snippet, 'nav below');
  });

  it('maps invalid regex reasons to LL-SEMANTIC-INVALID-PATTERN', () => {
    const diagnostics = collectSemanticDiagnostics([
      {
        element: 'title',
        relation: 'text-matches',
        pass: false,
        actual: 'hello',
        reason: 'Invalid regular expression: [abc',
      },
    ]);

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-SEMANTIC-INVALID-PATTERN');
    assert.strictEqual(diagnostics[0].range.start.line, 1);
  });

  it('does not emit semantic diagnostics for passing results or missing reasons', () => {
    const diagnostics = collectSemanticDiagnostics([
      {
        element: 'nav',
        relation: 'below',
        pass: true,
        actual: 10,
      },
      {
        element: 'aside',
        relation: 'left-of',
        pass: false,
        actual: null,
      },
    ]);

    assert.strictEqual(diagnostics.length, 0);
  });
});
