// Cross-runner comparison: the gallery and bar targeted mutants
// under Galen 2.4.4 with the translated specs in galen/ (their headers
// state the tolerance policy). Galen's `check` ignores --javascript, so
// each mutant is served as a page copy with the fault inlined (CSS as a
// final <style>, DOM actions as a body-end script). Detected = any check
// fails; both baselines must pass first. Runs headed via the pinned
// chromedriver in galen/. Writes results.json `galen` section.
//
// Run: node scripts/eval/galen-run.mjs
import { spawnSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { MUTANTS } from "./mutations.mjs";

// Path to the Galen 2.4.4 launcher; override for a local install.
const GALEN = process.env.GALEN_BIN ?? "galen";
const DIR = new URL("./galen/", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;
const PORT = 8132;
const PAGES = [
  { name: "gallery", spec: "gallery.gspec", path: "demo/gallery/index.html" },
  { name: "bar", spec: "bar.gspec", path: "demo/bar/index.html" },
];

const galenCheck = (spec, url, reportDir) => {
  const args = ["check", spec, "--url", url, "--size", "1280x900", "--jsonreport", reportDir];
  const r = spawnSync(GALEN, args, {
    cwd: DIR, env: { ...process.env, PATH: `${DIR}:${process.env.PATH}` },
    encoding: "utf8", timeout: 120000,
  });
  return r.stdout + r.stderr;
};

const parseReport = (reportDir) => {
  const file = readdirSync(`${DIR}${reportDir}`).find((f) => f.match(/^1-.*\.json$/));
  const d = JSON.parse(readFileSync(`${DIR}${reportDir}/${file}`, "utf8"));
  const failures = [];
  const walk = (node, objectName) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const name = node.name ?? objectName;
      if (node.status === "error" && Array.isArray(node.errors) && node.errors.length) {
        failures.push({ check: name, errors: node.errors });
      }
      for (const v of Object.values(node)) walk(v, name);
    } else if (Array.isArray(node)) {
      for (const v of node) walk(v, objectName);
    }
  };
  walk(d, null);
  // the root "Check layout" node repeats child errors as a summary; drop it
  return failures.filter((f) => !String(f.check).startsWith("Check layout"));
};

const main = async () => {
  const server = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"], {
    cwd: ROOT, stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1200));

  const report = { specs: ["scripts/eval/galen/gallery.gspec", "scripts/eval/galen/bar.gspec"], baselines: {}, mutants: [] };
  const tempPages = [];
  try {
    for (const pg of PAGES) {
      // ── baseline gate ──
      rmSync(`${DIR}rep-baseline-${pg.name}`, { recursive: true, force: true });
      galenCheck(pg.spec, `http://127.0.0.1:${PORT}/${pg.path}`, `rep-baseline-${pg.name}`);
      const baseFailures = parseReport(`rep-baseline-${pg.name}`);
      report.baselines[pg.name] = baseFailures.length === 0;
      console.log(`baseline ${pg.name}: ${baseFailures.length} failures`);
      if (baseFailures.length) {
        for (const f of baseFailures) console.log("  BASELINE FAIL:", f.check, f.errors);
        throw new Error("baseline not clean, aborting");
      }

      // ── mutants, served as page copies with the fault inlined ──
      const pageSource = readFileSync(`${ROOT}${pg.path}`, "utf8");
      const pageDir = pg.path.slice(0, pg.path.lastIndexOf("/"));
      for (const m of MUTANTS.filter((x) => x.page === pg.name)) {
        // CSS overrides become a final <style>; DOM actions become a script
        // at the end of <body>, running before Galen's checks.
        const mutated = m.css
          ? pageSource.replace("</head>", `<style>${m.css}</style>\n</head>`)
          : pageSource.replace("</body>", `<script>${m.action};</script>\n</body>`);
        const copy = `${ROOT}${pageDir}/.eval-${m.id}.html`;
        writeFileSync(copy, mutated);
        tempPages.push(copy);
        rmSync(`${DIR}rep-${m.id}`, { recursive: true, force: true });
        galenCheck(pg.spec, `http://127.0.0.1:${PORT}/${pageDir}/.eval-${m.id}.html`, `rep-${m.id}`);
        const failures = parseReport(`rep-${m.id}`);
        report.mutants.push({
          id: m.id, page: pg.name, category: m.category, expect: m.expect,
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

  const resultsUrl = new URL("./results.json", import.meta.url);
  const results = JSON.parse(readFileSync(resultsUrl, "utf8"));
  const ll = new Map(results.mutants.map((m) => [m.id, m.detected]));
  for (const m of report.mutants) m.layoutLintDetected = ll.get(m.id) ?? null;
  results.galen = report;
  writeFileSync(resultsUrl, JSON.stringify(results, null, 2));

  console.log("\nid   category    layout-lint  galen");
  for (const m of report.mutants) {
    console.log(`${m.id.padEnd(4)} ${m.category.padEnd(11)} ${String(m.layoutLintDetected).padEnd(12)} ${m.galenDetected}`);
  }
  console.log("written: scripts/eval/results.json (galen section)");
};

await main();
