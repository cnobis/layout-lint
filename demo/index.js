import { Parser, Language } from "./web-tree-sitter.js";

let _parserPromise = null;

async function getParser(wasmUrl, locateFile) {
  if (!_parserPromise) {
    _parserPromise = (async () => {
      await Parser.init();
      const lang = await Language.load("./layout_lint.wasm");
      const parser = new Parser();
      parser.setLanguage(lang);
      return parser;
    })();
  }
  return _parserPromise;
}

function extractRules(tree, source) {
  const root = tree.rootNode;
  const txt = (n) => source.slice(n.startIndex, n.endIndex);
  const rules = [];
  for (let i = 0; i < root.namedChildCount; i++) {
    const rule = root.namedChild(i);
    const element  = txt(rule.childForFieldName("element"));
    const relation = txt(rule.childForFieldName("relation"));
    const target   = txt(rule.childForFieldName("target"));
    const distTok  = txt(rule.childForFieldName("distance"));  // "20px"
    const m = distTok.match(/^(\d+)px$/);
    rules.push({ element, relation, target, distancePx: m ? +m[1] : NaN });
  }
  return rules;
}

function byId(name) { return document.getElementById(name) || null; }
const rect = (el) => (el ? el.getBoundingClientRect() : null);

function measure(relation, a, b) {
  const A = rect(a), B = rect(b);
  if (!A || !B) return null;
  switch (relation) {
    case "below":    return A.top  - B.bottom;
    case "above":    return B.top  - A.bottom;
    case "right_of": return A.left - B.right;
    case "left_of":  return B.left - A.right;
    default:         return null;
  }
}

/** public API */
export async function runLayoutLint({
  specText,
  wasmUrl,               // e.g. "/layout_lint.wasm"
  resolve = byId,        // map identifier -> Element (defaults to #id)
  locateFile,            // optional: where the runtime tree-sitter.wasm lives
} = {}) {
  if (!specText) throw new Error("specText is required");
  if (!wasmUrl)  throw new Error("wasmUrl is required");

  const parser = await getParser(wasmUrl, locateFile);
  const tree = parser.parse(specText);
  const rules = extractRules(tree, specText);

  const results = rules.map(r => {
    const a = resolve(r.element);
    const b = resolve(r.target);
    const d = measure(r.relation, a, b);
    if (d == null) {
      const missing = !a ? r.element : (!b ? r.target : "unknown");
      return { ...r, pass:false, actual:null, reason:`Element not found: ${missing}` };
    }
    return { ...r, actual:d, pass: d >= r.distancePx };
  });

  return { rules, results, tree };
}
