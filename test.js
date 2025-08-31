import { Parser, Language } from 'web-tree-sitter';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await Parser.init({
  locateFile(scriptName) {
    return path.join(__dirname, 'node_modules/web-tree-sitter', scriptName);
  },
});

const Lang = await Language.load(path.join(__dirname, 'layout_lint.wasm'));
const parser = new Parser();
parser.setLanguage(Lang);

// example input
const src = `button below header 20px
login right_of header 10px`;

const tree = parser.parse(src);

// helper to slice text for a node
const textFor = (node) => src.slice(node.startIndex, node.endIndex);

// walk: source_file -> repeat(rule)
const root = tree.rootNode;
const constraints = [];
for (let i = 0; i < root.namedChildCount; i++) {
  const rule = root.namedChild(i);

  const elementNode  = rule.childForFieldName('element');
  const relationNode = rule.childForFieldName('relation');
  const targetNode   = rule.childForFieldName('target');
  const distNode     = rule.childForFieldName('distance');

  const element  = textFor(elementNode);
  const relation = textFor(relationNode);
  const target   = textFor(targetNode);
  const distTok  = textFor(distNode); // e.g. "20px"
  const m = distTok.match(/^(\d+)px$/);
  const distancePx = m ? parseInt(m[1], 10) : NaN;

  constraints.push({ element, relation, target, distancePx });
}

console.log(constraints);
