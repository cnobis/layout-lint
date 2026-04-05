import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractRules } from '../dist/core/dsl.js';

const makeNode = ({
  type,
  text,
  startIndex,
  endIndex,
  isMissing = false,
  children = [],
  namedChildren = [],
  fields = {},
}) => ({
  type,
  text,
  startIndex,
  endIndex,
  isMissing,
  childCount: children.length,
  namedChildCount: namedChildren.length,
  child: (index) => children[index] ?? null,
  namedChild: (index) => namedChildren[index] ?? null,
  childForFieldName: (name) => fields[name] ?? null,
  childrenForFieldName: (name) => {
    const value = fields[name];
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  },
});

describe('parse diagnostics extraction', () => {
  it('reports syntax diagnostics for ERROR nodes with source range metadata', () => {
    const source = 'nav below header 10px\nnav ??? header';
    const errorNode = makeNode({
      type: 'ERROR',
      text: '???',
      startIndex: 25,
      endIndex: 28,
    });
    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [errorNode],
      namedChildren: [],
    });

    const { rules, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(rules.length, 0);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-PARSE-SYNTAX');
    assert.strictEqual(diagnostics[0].range.start.line, 2);
    assert.strictEqual(diagnostics[0].range.start.column, 3);
    assert.ok((diagnostics[0].snippet ?? '').startsWith('??'));
  });

  it('reports malformed rule diagnostics when required fields are missing', () => {
    const source = 'broken rule text';
    const malformedRule = makeNode({
      type: 'rule',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      fields: {},
    });
    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [malformedRule],
      namedChildren: [malformedRule],
    });

    const { diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-RULE-MALFORMED');
    assert.ok(diagnostics[0].message.includes('Malformed rule'));
  });

  it('collapses adjacent parser recovery diagnostics into a single primary issue', () => {
    const source = 'nav abave header 10px';
    const firstError = makeNode({
      type: 'ERROR',
      text: 'abave',
      startIndex: 4,
      endIndex: 9,
    });
    const secondError = makeNode({
      type: 'ERROR',
      text: ' ',
      startIndex: 9,
      endIndex: 10,
    });
    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [firstError, secondError],
      namedChildren: [],
    });

    const { diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-PARSE-SYNTAX');
    assert.strictEqual(diagnostics[0].relatedDiagnosticsCount, 1);
    assert.strictEqual(diagnostics[0].message, 'Invalid spec syntax near this segment.');
    assert.strictEqual(diagnostics[0].relatedDiagnostics?.length, 1);
    assert.strictEqual(diagnostics[0].relatedDiagnostics?.[0].code, 'LL-PARSE-SYNTAX');
    assert.strictEqual(diagnostics[0].relatedDiagnostics?.[0].range.startIndex, 9);
  });

  it('adds a typo suggestion for close parse-keyword mistakes', () => {
    const source = 'nav abave header 10px';
    const errorNode = makeNode({
      type: 'ERROR',
      text: 'abave',
      startIndex: 4,
      endIndex: 9,
    });
    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [errorNode],
      namedChildren: [],
    });

    const { diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-PARSE-SYNTAX');
    assert.strictEqual(diagnostics[0].suggestion, 'above');
  });

  it('returns no diagnostics for well-formed default relation rules', () => {
    const source = 'nav below header 10px';
    const elementNode = makeNode({ type: 'identifier', text: 'nav', startIndex: 0, endIndex: 3 });
    const relationNode = makeNode({ type: 'relation', text: 'below', startIndex: 4, endIndex: 9 });
    const targetNode = makeNode({ type: 'identifier', text: 'header', startIndex: 10, endIndex: 16 });
    const distanceNode = makeNode({ type: 'distance', text: '10px', startIndex: 17, endIndex: 21 });

    const ruleNode = makeNode({
      type: 'rule',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      fields: {
        element: elementNode,
        relation: relationNode,
        target: targetNode,
        distance: distanceNode,
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [ruleNode],
      namedChildren: [ruleNode],
    });

    const { rules, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(rules.length, 1);
    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(rules[0].relation, 'below');
    assert.strictEqual(rules[0].distancePx, 10);
  });
});
