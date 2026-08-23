// cross-runner comparison: the gallery and bar targeted mutants run through
// galen 2.4.4 against the translated specs in galen/. galen check ignores
// --javascript, so each mutant is served as a page copy with the fault
// inlined, css as a final style tag and dom actions as a body-end script.
// detected means any check failed; both baselines must pass first.
//
// run: GALEN_BIN=<path to the galen launcher> node scripts/eval/galen-run.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { MUTANTS, PAGES } from "./mutations.mjs";
import { serve, REPO_ROOT } from "./helpers.mjs";
import { stamp } from "./version.mjs";

const GALEN = process.env.GALEN_BIN ?? "galen";
const DIR = new URL("./galen/", import.meta.url).pathname;
const PORT = 8132;
const SPECS = { gallery: "gallery.gspec", bar: "bar.gspec" };

// runs headed over the pinned chromedriver in galen/
const galenCheck = (spec, url, reportDir) => {
  spawnSync(GALEN, ["check", spec, "--url", url, "--size", "1280x900", "--jsonreport", reportDir], {
    cwd: DIR,
    env: { ...process.env, PATH: `${DIR}:${process.env.PATH}` },
    encoding: "utf8",
    timeout: 120000,
  });
};

// galen names its report 1-<page title>.json and nests sections and objects
// arbitrarily, so walk the whole tree and collect every errored check. the
// root "Check layout" node repeats its children's errors and is dropped
const readFailures = (reportDir) => {
  const file = readdirSync(`${DIR}${reportDir}`).find((f) => /^1-.*\.json$/.test(f));
  const failures = [];
  const walk = (node, name) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, name);
      return;
    }
    if (!node || typeof node !== "object") return;
    const nodeName = node.name ?? name;
    if (node.status === "error" && Array.isArray(node.errors) && node.errors.length) {
      failures.push({ check: nodeName, errors: node.errors });
    }
    for (const child of Object.values(node)) walk(child, nodeName);
  };
  walk(JSON.parse(readFileSync(`${DIR}${reportDir}/${file}`, "utf8")), null);
  return failures.filter((f) => !String(f.check).startsWith("Check layout"));
};

const server = await serve(PORT);
const report = { specs: Object.values(SPECS).map((s) => `scripts/eval/galen/${s}`), baselines: {}, mutants: [] };
const tempPages = [];

try {
  for (const [name, spec] of Object.entries(SPECS)) {
    const path = PAGES[name];
    rmSync(`${DIR}rep-baseline-${name}`, { recursive: true, force: true });
    galenCheck(spec, `http://127.0.0.1:${PORT}${path}`, `rep-baseline-${name}`);
    const baseFailures = readFailures(`rep-baseline-${name}`);
    report.baselines[name] = baseFailures.length === 0;
    console.log(`baseline ${name}: ${baseFailures.length} failures`);
    if (baseFailures.length) throw new Error("baseline not clean, aborting");

    const pageSource = readFileSync(REPO_ROOT + path, "utf8");
    const pageDir = path.slice(0, path.lastIndexOf("/"));
    for (const m of MUTANTS.filter((x) => x.page === name)) {
      const mutated = m.css
        ? pageSource.replace("</head>", `<style>${m.css}</style>\n</head>`)
        : pageSource.replace("</body>", `<script>${m.action};</script>\n</body>`);
      const copy = `${REPO_ROOT}${pageDir}/.eval-${m.id}.html`;
      writeFileSync(copy, mutated);
      tempPages.push(copy);
      rmSync(`${DIR}rep-${m.id}`, { recursive: true, force: true });
      galenCheck(spec, `http://127.0.0.1:${PORT}${pageDir}/.eval-${m.id}.html`, `rep-${m.id}`);
      const failures = readFailures(`rep-${m.id}`);
      report.mutants.push({
        id: m.id, page: name, category: m.category, expect: m.expect,
        galenDetected: failures.length > 0,
        failingChecks: failures.map((f) => `${f.check}: ${f.errors.join("; ")}`),
      });
      console.log(`${m.id} [${m.category}] ${failures.length ? "DETECTED" : "survived"} (${failures.length} checks)`);
    }
  }
} finally {
  for (const p of tempPages) rmSync(p, { force: true });
  server.kill();
}

// merge with layout-lint's verdicts from the targeted study
const resultsUrl = new URL("./results.json", import.meta.url);
const results = JSON.parse(readFileSync(resultsUrl, "utf8"));
const layoutLintDetected = new Map();
for (const m of results.mutants) layoutLintDetected.set(m.id, m.detected);
for (const m of report.mutants) m.layoutLintDetected = layoutLintDetected.get(m.id) ?? null;
results.galen = report;
results.layoutLint = stamp();
writeFileSync(resultsUrl, JSON.stringify(results, null, 2));

console.log("\nid   category    layout-lint  galen");
for (const m of report.mutants) {
  console.log(`${m.id.padEnd(4)} ${m.category.padEnd(11)} ${String(m.layoutLintDetected).padEnd(12)} ${m.galenDetected}`);
}
console.log("written: scripts/eval/results.json (galen section)");
