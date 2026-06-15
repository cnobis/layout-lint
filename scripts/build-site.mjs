/**
 * Assemble a self-contained, deployable showcase site into ./site.
 *
 * Layout produced (the playground landing becomes the site root):
 *   site/index.html              <- demo/index.html (front door)
 *   site/{tutorial,gallery,...}  <- the rest of demo/
 *   site/dist/*.bundle.js        <- the built library bundles (wasm inlined)
 *
 * The demo pages load the library as `../../dist/<x>.bundle.js`, which assumes
 * dist is a sibling of demo (the repo layout). In the assembled site the demo
 * contents sit at the root, so every bundle-loading page is one level shallower;
 * we rewrite `../../dist/` -> `../dist/` to match. The grammar WASM is base64
 * inlined into the bundles, so no separate .wasm file is needed.
 *
 * Run with:  npm run build:site   (which builds dist + railroad first)
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, extname } from "node:path";
import { rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const demoDir = join(root, "demo");
const distDir = join(root, "dist");
const siteDir = join(root, "site");

// 1. Fresh output directory.
rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

// 2. demo/* -> site/ (playground index.html lands at the site root). Skip the
// developer-facing demo README; the deployed site is for end users.
cpSync(demoDir, siteDir, {
  recursive: true,
  filter: (src) => src !== join(demoDir, "README.md"),
});

// 3. The built bundles -> site/dist/. The grammar + runtime WASM are base64
// inlined into each bundle, so only the top-level *.bundle.js files are needed.
mkdirSync(join(siteDir, "dist"), { recursive: true });
for (const entry of readdirSync(distDir)) {
  if (entry.endsWith(".bundle.js")) {
    cpSync(join(distDir, entry), join(siteDir, "dist", entry));
  }
}

// 4. Rewrite the bundle paths now that demo contents are one level shallower.
let rewritten = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist") continue; // leave the bundles untouched
      walk(full);
    } else if (extname(entry.name) === ".html") {
      const before = readFileSync(full, "utf8");
      const after = before.replaceAll("../../dist/", "../dist/");
      if (after !== before) {
        writeFileSync(full, after, "utf8");
        rewritten += 1;
      }
    }
  }
};
walk(siteDir);

console.log(`site: assembled ./site (rewrote bundle paths in ${rewritten} page(s))`);
