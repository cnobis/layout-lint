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

describe('define syntax', () => {
  it('extracts definitions from definition nodes', () => {
    const source = 'define nav as ".main-nav";';
    const defNode = makeNode({
      type: 'definition',
      text: 'define nav as ".main-nav"',
      startIndex: 0,
      endIndex: 25,
      fields: {
        name: makeNode({ type: 'identifier', text: 'nav', startIndex: 7, endIndex: 10 }),
        selector: makeNode({ type: 'quoted_text', text: '".main-nav"', startIndex: 14, endIndex: 25 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode],
      namedChildren: [defNode],
    });

    const { rules, definitions, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(rules.length, 0);
    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(definitions.size, 1);
    assert.strictEqual(definitions.get('nav'), '.main-nav');
  });

  it('definitions precede rules without interference', () => {
    const source = 'define nav as ".main-nav"; nav below header 10px;';
    const defNode = makeNode({
      type: 'definition',
      text: 'define nav as ".main-nav"',
      startIndex: 0,
      endIndex: 25,
      fields: {
        name: makeNode({ type: 'identifier', text: 'nav', startIndex: 7, endIndex: 10 }),
        selector: makeNode({ type: 'quoted_text', text: '".main-nav"', startIndex: 14, endIndex: 25 }),
      },
    });
    const ruleNode = makeNode({
      type: 'rule',
      text: 'nav below header 10px',
      startIndex: 27,
      endIndex: 48,
      fields: {
        element: makeNode({ type: 'identifier', text: 'nav', startIndex: 27, endIndex: 30 }),
        relation: makeNode({ type: 'relation', text: 'below', startIndex: 31, endIndex: 36 }),
        target: makeNode({ type: 'identifier', text: 'header', startIndex: 37, endIndex: 43 }),
        distance: makeNode({ type: 'distance', text: '10px', startIndex: 44, endIndex: 48 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode, ruleNode],
      namedChildren: [defNode, ruleNode],
    });

    const { rules, definitions, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(definitions.size, 1);
    assert.strictEqual(definitions.get('nav'), '.main-nav');
    assert.strictEqual(rules.length, 1);
    assert.strictEqual(rules[0].element, 'nav');
    assert.strictEqual(rules[0].relation, 'below');
  });

  it('handles multiple definitions', () => {
    const source = 'define nav as ".main-nav"; define hero as "#hero-section";';
    const defNode1 = makeNode({
      type: 'definition',
      text: 'define nav as ".main-nav"',
      startIndex: 0,
      endIndex: 25,
      fields: {
        name: makeNode({ type: 'identifier', text: 'nav', startIndex: 7, endIndex: 10 }),
        selector: makeNode({ type: 'quoted_text', text: '".main-nav"', startIndex: 14, endIndex: 25 }),
      },
    });
    const defNode2 = makeNode({
      type: 'definition',
      text: 'define hero as "#hero-section"',
      startIndex: 27,
      endIndex: 57,
      fields: {
        name: makeNode({ type: 'identifier', text: 'hero', startIndex: 34, endIndex: 38 }),
        selector: makeNode({ type: 'quoted_text', text: '"#hero-section"', startIndex: 42, endIndex: 57 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode1, defNode2],
      namedChildren: [defNode1, defNode2],
    });

    const { definitions } = extractRules({ rootNode }, source);

    assert.strictEqual(definitions.size, 2);
    assert.strictEqual(definitions.get('nav'), '.main-nav');
    assert.strictEqual(definitions.get('hero'), '#hero-section');
  });

  it('extracts wildcard definitions from wildcard_name nodes', () => {
    const source = 'define card-* as ".gallery .card";';
    const defNode = makeNode({
      type: 'definition',
      text: 'define card-* as ".gallery .card"',
      startIndex: 0,
      endIndex: 33,
      fields: {
        name: makeNode({ type: 'wildcard_name', text: 'card-*', startIndex: 7, endIndex: 13 }),
        selector: makeNode({ type: 'quoted_text', text: '".gallery .card"', startIndex: 17, endIndex: 33 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode],
      namedChildren: [defNode],
    });

    const { rules, definitions, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(rules.length, 0);
    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(definitions.size, 1);
    assert.strictEqual(definitions.get('card-*'), '.gallery .card');
  });

  it('stores wildcard and regular definitions together', () => {
    const source = 'define nav as ".main-nav"; define item-* as "#menu li";';
    const defNode1 = makeNode({
      type: 'definition',
      text: 'define nav as ".main-nav"',
      startIndex: 0,
      endIndex: 25,
      fields: {
        name: makeNode({ type: 'identifier', text: 'nav', startIndex: 7, endIndex: 10 }),
        selector: makeNode({ type: 'quoted_text', text: '".main-nav"', startIndex: 14, endIndex: 25 }),
      },
    });
    const defNode2 = makeNode({
      type: 'definition',
      text: 'define item-* as "#menu li"',
      startIndex: 27,
      endIndex: 54,
      fields: {
        name: makeNode({ type: 'wildcard_name', text: 'item-*', startIndex: 34, endIndex: 40 }),
        selector: makeNode({ type: 'quoted_text', text: '"#menu li"', startIndex: 44, endIndex: 54 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode1, defNode2],
      namedChildren: [defNode1, defNode2],
    });

    const { definitions } = extractRules({ rootNode }, source);

    assert.strictEqual(definitions.size, 2);
    assert.strictEqual(definitions.get('nav'), '.main-nav');
    assert.strictEqual(definitions.get('item-*'), '#menu li');
  });
});

describe('group definitions', () => {
  it('extracts group definitions from group_definition nodes', () => {
    const source = 'group skeleton as header, nav, content, footer;';
    const groupNode = makeNode({
      type: 'group_definition',
      text: 'group skeleton as header, nav, content, footer',
      startIndex: 0,
      endIndex: 47,
      fields: {
        name: makeNode({ type: 'identifier', text: 'skeleton', startIndex: 6, endIndex: 14 }),
        member: [
          makeNode({ type: 'identifier', text: 'header', startIndex: 18, endIndex: 24 }),
          makeNode({ type: 'identifier', text: 'nav', startIndex: 26, endIndex: 29 }),
          makeNode({ type: 'identifier', text: 'content', startIndex: 31, endIndex: 38 }),
          makeNode({ type: 'identifier', text: 'footer', startIndex: 40, endIndex: 46 }),
        ],
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [groupNode],
      namedChildren: [groupNode],
    });

    const { rules, groups, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(rules.length, 0);
    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(groups.size, 1);
    assert.deepStrictEqual(groups.get('skeleton'), ['header', 'nav', 'content', 'footer']);
  });

  it('expands group references into multiple rules', () => {
    const source = 'group skeleton as header, footer; @skeleton inside screen;';
    const groupNode = makeNode({
      type: 'group_definition',
      text: 'group skeleton as header, footer',
      startIndex: 0,
      endIndex: 31,
      fields: {
        name: makeNode({ type: 'identifier', text: 'skeleton', startIndex: 6, endIndex: 14 }),
        member: [
          makeNode({ type: 'identifier', text: 'header', startIndex: 18, endIndex: 24 }),
          makeNode({ type: 'identifier', text: 'footer', startIndex: 26, endIndex: 32 }),
        ],
      },
    });
    const ruleNode = makeNode({
      type: 'rule',
      text: '@skeleton inside screen',
      startIndex: 34,
      endIndex: 57,
      fields: {
        element: makeNode({ type: 'group_reference', text: '@skeleton', startIndex: 34, endIndex: 43 }),
        relation: makeNode({ type: 'relation', text: 'inside', startIndex: 44, endIndex: 50 }),
        target: makeNode({ type: 'identifier', text: 'screen', startIndex: 51, endIndex: 57 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [groupNode, ruleNode],
      namedChildren: [groupNode, ruleNode],
    });

    const { rules, groups, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(groups.size, 1);
    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(rules.length, 2);
    assert.strictEqual(rules[0].element, 'header');
    assert.strictEqual(rules[0].relation, 'inside');
    assert.strictEqual(rules[1].element, 'footer');
    assert.strictEqual(rules[1].relation, 'inside');
  });

  it('emits diagnostic for unknown group reference', () => {
    const source = '@missing inside screen;';
    const ruleNode = makeNode({
      type: 'rule',
      text: '@missing inside screen',
      startIndex: 0,
      endIndex: 22,
      fields: {
        element: makeNode({ type: 'group_reference', text: '@missing', startIndex: 0, endIndex: 8 }),
        relation: makeNode({ type: 'relation', text: 'inside', startIndex: 9, endIndex: 15 }),
        target: makeNode({ type: 'identifier', text: 'screen', startIndex: 16, endIndex: 22 }),
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

    assert.strictEqual(rules.length, 0);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, 'LL-SEMANTIC-UNKNOWN-GROUP');
    assert.ok(diagnostics[0].message.includes('missing'));
  });

  it('groups work alongside definitions', () => {
    const source = 'define nav as ".main-nav"; group top as nav, header; @top visible;';
    const defNode = makeNode({
      type: 'definition',
      text: 'define nav as ".main-nav"',
      startIndex: 0,
      endIndex: 25,
      fields: {
        name: makeNode({ type: 'identifier', text: 'nav', startIndex: 7, endIndex: 10 }),
        selector: makeNode({ type: 'quoted_text', text: '".main-nav"', startIndex: 14, endIndex: 25 }),
      },
    });
    const groupNode = makeNode({
      type: 'group_definition',
      text: 'group top as nav, header',
      startIndex: 27,
      endIndex: 51,
      fields: {
        name: makeNode({ type: 'identifier', text: 'top', startIndex: 33, endIndex: 36 }),
        member: [
          makeNode({ type: 'identifier', text: 'nav', startIndex: 40, endIndex: 43 }),
          makeNode({ type: 'identifier', text: 'header', startIndex: 45, endIndex: 51 }),
        ],
      },
    });
    const ruleNode = makeNode({
      type: 'rule',
      text: '@top visible',
      startIndex: 53,
      endIndex: 65,
      fields: {
        element: makeNode({ type: 'group_reference', text: '@top', startIndex: 53, endIndex: 57 }),
        visibility_relation: makeNode({ type: 'visibility_relation', text: 'visible', startIndex: 58, endIndex: 65 }),
      },
    });

    const rootNode = makeNode({
      type: 'source_file',
      text: source,
      startIndex: 0,
      endIndex: source.length,
      children: [defNode, groupNode, ruleNode],
      namedChildren: [defNode, groupNode, ruleNode],
    });

    const { rules, definitions, groups, diagnostics } = extractRules({ rootNode }, source);

    assert.strictEqual(diagnostics.length, 0);
    assert.strictEqual(definitions.size, 1);
    assert.strictEqual(groups.size, 1);
    assert.strictEqual(rules.length, 2);
    assert.strictEqual(rules[0].element, 'nav');
    assert.strictEqual(rules[0].relation, 'visible');
    assert.strictEqual(rules[1].element, 'header');
    assert.strictEqual(rules[1].relation, 'visible');
  });
});
