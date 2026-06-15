/**
 * Generate railroad (syntax) diagrams from the curated EBNF grammar.
 *
 * Source of truth:  docs/grammar.ebnf  (ISO/IEC 14977)
 * Outputs:
 *   - demo/internals/grammar.html        full navigable grammar reference page
 *   - demo/internals/railroad/<rule>.svg one SVG per production (served by demo)
 *   - docs/railroad/<rule>.svg           same SVGs, for use as thesis figures
 *
 * Run with:  npm run build:railroad
 *
 * Uses ebnf2railroad's public API (parseEbnf, createDocumentation) plus its
 * internal createDiagram/toc helpers for clean per-production SVG export. This
 * is a build-time-only script, so depending on the pinned package internals is
 * acceptable; the dependency version is locked in package-lock.json.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const { parseEbnf, createDocumentation, documentStyle } = require("ebnf2railroad");
const { createDiagram } = require("ebnf2railroad/src/build-diagram");
const {
  createStructuralToc,
  createDefinitionMetadata,
} = require("ebnf2railroad/src/toc");

const ebnfPath = join(root, "docs", "grammar.ebnf");
const demoDir = join(root, "demo", "internals");
const demoSvgDir = join(demoDir, "railroad");
const docsSvgDir = join(root, "docs", "railroad");

const ebnf = readFileSync(ebnfPath, "utf8");
const ast = parseEbnf(ebnf);

// ── 1. Full HTML reference page ──────────────────────────────────────
const rawHtml = createDocumentation(ast, {
  title: "layout-lint grammar",
  optimizeDiagrams: true,
  optimizeText: false,
  textFormatting: true,
  overviewDiagram: true,
  diagramWrap: 600,
});

// Brand the generated page: inject the layout-lint theme (after ebnf2railroad's
// own stylesheet so it wins), turn the title bar into the purple brand banner
// (logo only), and replace the inert dark/light + date footer with a single
// minimal line. The theme keeps the clean light layout on purpose.
const themeCss = readFileSync(join(root, "docs", "grammar-theme.css"), "utf8");
const brandBanner =
  `<a class="ll-doc-home" href="../index.html" aria-label="layout-lint playground">` +
  `<img class="ll-doc-name" src="../images/name.svg" alt="layout-lint" />` +
  `<img class="ll-doc-shapes" src="../images/shapes.svg" alt="" aria-hidden="true" />` +
  `</a>`;
const minimalFooter =
  `<p class="ll-doc-back">layout-lint language reference. ` +
  `<a href="../index.html">Back to the playground</a>.</p><footer></footer>`;

// Rebuild the nav so it follows the EBNF source order and is grouped by the
// "## Section" headings already written in grammar.ebnf. The page's own section
// structure becomes the sidebar structure (replaces ebnf2railroad's alphabetical
// Root/Quick/Common/Character-set grouping).
const toId = (s) => s.replace(/\s+/g, "-");
const navGroups = [{ title: "Root", items: [] }];
for (const node of ast) {
  if (node.comment) {
    const heading = node.comment.match(/##\s+(.+)/);
    if (heading) navGroups.push({ title: heading[1].trim(), items: [] });
  } else if (node.identifier) {
    navGroups[navGroups.length - 1].items.push(node.identifier);
  }
}
const navHtml = navGroups
  .filter((g) => g.items.length)
  .map((g) => {
    const lis = g.items
      .map((id) => `<li><a href="#${toId(id)}">${id}</a></li>`)
      .join("\n        ");
    return `    <h3>${g.title}</h3>\n    <ul class="nav-alphabetical">\n        ${lis}\n    </ul>`;
  })
  .join("\n");
const orderedNav = `<nav>\n${navHtml}\n  </nav>`;

// Structural replacements first (before CSS injection so the theme comment
// text can't accidentally match the footer/nav regexes).
const html = rawHtml
  .replace("<h1>layout-lint grammar</h1>", brandBanner)
  .replace(/<footer>[\s\S]*?<\/footer>/, minimalFooter)
  .replace(/<nav>[\s\S]*?<\/nav>/, orderedNav)
  .replace("</head>", `<style type="text/css">\n${themeCss}\n</style>\n</head>`);

mkdirSync(demoDir, { recursive: true });
writeFileSync(join(demoDir, "grammar.html"), html, "utf8");

// ── 2. Per-production SVG files ──────────────────────────────────────
// Standalone SVGs need the diagram CSS inlined, otherwise paths render as
// solid black blobs (no stroke). Pull the :root variables and the
// svg.railroad-diagram rules out of ebnf2railroad's document stylesheet; in a
// standalone SVG, `:root` resolves to the <svg> element so the vars cascade.
const fullStyle = documentStyle();
const rootVars = (fullStyle.match(/:root\s*{[^}]*}/) || [""])[0];
const svgRules = fullStyle.slice(fullStyle.indexOf("svg.railroad-diagram {"));
const DIAGRAM_CSS = `${rootVars}\nsvg.railroad-diagram{background:var(--diagramBackground)}\n${svgRules}`;

const inlineStyle = (svg) =>
  svg.replace(/(<svg\b[^>]*>)/, `$1\n<style>\n${DIAGRAM_CSS}\n</style>`);

const metadata = createDefinitionMetadata(createStructuralToc(ast));

// Start from clean diagram dirs so removed productions don't leave stragglers.
for (const dir of [demoSvgDir, docsSvgDir]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

const dasherize = (s) => s.replace(/\s+/g, "-");
let count = 0;
for (const production of ast) {
  if (!production.identifier) continue; // skip comment nodes
  const svg = createDiagram(production, metadata, ast, {
    optimizeDiagrams: true,
    overview: false,
    complex: false,
  });
  const file = `${dasherize(production.identifier)}.svg`;
  const styled = inlineStyle(svg);
  writeFileSync(join(demoSvgDir, file), styled, "utf8");
  writeFileSync(join(docsSvgDir, file), styled, "utf8");
  count += 1;
}

console.log(
  `railroad: wrote grammar.html + ${count} SVGs to demo/internals/railroad and docs/railroad`,
);
