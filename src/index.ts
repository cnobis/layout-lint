import Parser from 'tree-sitter';
import fs from 'node:fs';
import path from 'node:path';

// The native module produced by `tree-sitter build`
const lang = (await import(
  path.resolve('grammars/layoutspec/build/Release/tree_sitter_layoutspec.node')
)) as any;

export type Constraint =
  | { kind: 'exists'; a: string }
  | { kind: 'below'; a: string; b: string; min: number; max?: number; unit: 'px' | '%' }
  | { kind: 'rightOf'; a: string; b: string; min: number; max?: number; unit: 'px' | '%' }
  | { kind: 'inside'; a: string; b: string }
  | { kind: 'cssProp'; a: string; prop: string; value: string };

export function parseLayoutSpec(source: string): { constraints: Constraint[] } {
  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(source);
  const root = tree.rootNode;

  const constraints: Constraint[] = [];

  function text(n: Parser.SyntaxNode) { return source.slice(n.startIndex, n.endIndex); }

  for (const rule of root.descendantsOfType('rule')) {
    const selectorNode = rule.childForFieldName('selector');
    const assertion = rule.childForFieldName('assertion');
    if (!selectorNode || !assertion) continue;

    const a = text(selectorNode);

    // assertion forms
    const type = assertion.firstChild?.type ?? assertion.type;
    switch (type) {
      case 'exists':
        constraints.push({ kind: 'exists', a });
        break;
      case 'below': {
        const b = text(assertion.childForFieldName('target')!);
        const r = assertion.childForFieldName('gap')!;
        const [min, max, unit] = parseRange(source, r);
        constraints.push({ kind: 'below', a, b, min, ...(max !== undefined ? { max } : {}), unit });
        break;
      }
      case 'right-of': {
        const b = text(assertion.childForFieldName('target')!);
        const r = assertion.childForFieldName('gap')!;
        const [min, max, unit] = parseRange(source, r);
        constraints.push({ kind: 'rightOf', a, b, min, ...(max !== undefined ? { max } : {}), unit });
        break;
      }
      case 'inside': {
        const b = text(assertion.childForFieldName('target')!);
        constraints.push({ kind: 'inside', a, b });
        break;
      }
      default: {
        // css property form: <prop> <value>
        const prop = assertion.childForFieldName('prop');
        const value = assertion.childForFieldName('value');
        if (prop && value) {
          constraints.push({ kind: 'cssProp', a, prop: text(prop), value: text(value) });
        }
      }
    }
  }

  return { constraints };
}

function parseRange(src: string, r: Parser.SyntaxNode): [number, number | undefined, 'px' | '%'] {
  // forms: "16px" or "16-32px"
  const s = src.slice(r.startIndex, r.endIndex).trim();
  const m = s.match(/^(\d+)(px|%)(?:-(\d+)(?:px|%))?$/);
  if (!m) throw new Error(`Invalid range: ${s}`);
  const min = Number(m[1]);
  const unit = m[2] as 'px' | '%';
  const max = m[3] ? Number(m[3]) : undefined;
  return [min, max, unit];
}
