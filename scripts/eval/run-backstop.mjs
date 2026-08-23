// pixel-oracle comparison: the targeted catalog and five probes run through
// backstopjs at default settings. the reference run captures each page
// clean, the test run captures it with the fault applied, and detected
// means the mismatch crossed backstop's default threshold.
//
// run: node scripts/eval/run-backstop.mjs   (merges into results.json)
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { MUTANTS, PAGES } from "./mutations.mjs";
import { serve, REPO_ROOT } from "./helpers.mjs";

const PORT = 8127;
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = new URL("./backstop/", import.meta.url).pathname;

// probes join the catalog: three benign changes no rule constrains (verified
// green in layout-lint beforehand) and two already-hidden elements, so both
// oracles are also measured on changes that are not faults
const PROBES = [
  { id: "BP1", page: "gallery", category: "benign", expect: "backstop-only",
    action: `(() => { const a = document.querySelector("#artwork-1 img"), b = document.querySelector("#artwork-2 img"); const s = a.src; a.src = b.src; b.src = s; })()`,
    note: "artworks 1 and 2 swap images inside their fixed frames" },
  { id: "BP2", page: "gallery", category: "benign", expect: "backstop-only",
    action: `document.querySelector("#gallery-name").textContent = "Galerie Vallée"`,
    note: "headline wording changes; no text rule binds it" },
  { id: "BP3", page: "bar", category: "benign", expect: "backstop-only",
    css: "#board{background:#4a3728 !important}",
    note: "board wood tone changes; no rule constrains it" },
  { id: "EQ1", page: "bar", category: "equivalent", expect: "neither",
    css: "#staff-note{display:none !important}",
    note: "hides an element that is already hidden" },
  { id: "EQ2", page: "studio", category: "equivalent", expect: "neither",
    css: "#clip-light{display:none !important}",
    note: "hides the hidden overload light" },
];

// one backstop scenario per mutant and probe; onReady.cjs applies the
// mutation on the test run only
const scenarios = [];
for (const m of [...MUTANTS, ...PROBES]) {
  scenarios.push({
    label: m.id,
    url: BASE + PAGES[m.page],
    mutation: { css: m.css ?? null, action: m.action ?? null },
    delay: 400,
    onReadyScript: "onReady.cjs",
  });
}
writeFileSync(`${DIR}scenarios.json`, JSON.stringify(scenarios, null, 2));
rmSync(`${DIR}data`, { recursive: true, force: true });

// backstop test exits non-zero when scenarios mismatch, and a mismatch is
// the measurement here, so the exit code is informational only
const runBackstop = (cmd) =>
  new Promise((resolve) => {
    const proc = spawn("npx", ["backstop", cmd, `--config=${DIR}backstop.config.cjs`], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    proc.on("exit", (code) => resolve(code));
  });

const server = await serve(PORT);
try {
  console.log("-- backstop reference (mutations off) --");
  if (await runBackstop("reference") !== 0) throw new Error("reference run failed");
  console.log("-- backstop test (mutations on) --");
  await runBackstop("test");
} finally {
  server.kill();
}

// merge the pixel verdicts with layout-lint's from the targeted study
const tests = JSON.parse(readFileSync(`${DIR}data/json_report/jsonReport.json`, "utf8")).tests;
const resultsUrl = new URL("./results.json", import.meta.url);
const results = JSON.parse(readFileSync(resultsUrl, "utf8"));
const layoutLintDetected = new Map();
for (const m of results.mutants) layoutLintDetected.set(m.id, m.detected);
const byId = new Map();
for (const m of [...MUTANTS, ...PROBES]) byId.set(m.id, m);

const rows = [];
for (const t of tests) {
  const m = byId.get(t.pair.label);
  rows.push({
    id: m.id, page: m.page, category: m.category, expect: m.expect,
    layoutLintDetected: layoutLintDetected.get(m.id) ?? false,
    backstopDetected: t.status === "fail",
    mismatchPercent: t.pair.diff?.misMatchPercentage ?? "0",
  });
}
results.backstop = { scenarios: rows };
writeFileSync(resultsUrl, JSON.stringify(results, null, 2));

console.log("\nid     category      layout-lint  backstop   mismatch%");
for (const r of rows) {
  console.log(`${r.id.padEnd(6)} ${r.category.padEnd(13)} ${String(r.layoutLintDetected).padEnd(12)} ${String(r.backstopDetected).padEnd(10)} ${r.mismatchPercent}`);
}
console.log("\nwritten: scripts/eval/results.json (backstop section)");
