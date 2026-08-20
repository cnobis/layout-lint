// Pixel-oracle comparison: the targeted catalog run through
// BackstopJS at default settings, plus three benign-change probes (verified
// green in layout-lint first) and two already-hidden equivalent probes.
// `backstop reference` captures each page unmutated, `backstop test` with
// the fault applied (onReady.cjs keys on isReference); detected = mismatch
// above the default threshold. Results land in results.json under
// `backstop`.
//
// Run: node scripts/eval/run-backstop.mjs [--survivors]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { MUTANTS, PAGES } from "./mutations.mjs";
import { OPERATORS, pageHelpers } from "./systematic.mjs";

const PORT = 8127;
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = new URL("./backstop/", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;

export const PROBES = [
  { id: "BP1", page: "gallery", category: "benign", expect: "backstop-only",
    action: `(() => { const a = document.querySelector("#artwork-1 img"), b = document.querySelector("#artwork-2 img"); const s = a.src; a.src = b.src; b.src = s; })()`,
    note: "artworks 1 and 2 swap images; same 3:4 boxes, no geometric change" },
  { id: "BP2", page: "gallery", category: "benign", expect: "backstop-only",
    action: `document.querySelector("#gallery-name").textContent = "Galerie Vallée"`,
    note: "headline wording changes; the spec has no text rule on the gallery page" },
  { id: "BP3", page: "bar", category: "benign", expect: "backstop-only",
    css: "#board{background:#4a3728 !important}",
    note: "board wood tone changes; no rule constrains the board's background" },
  { id: "EQ1", page: "bar", category: "equivalent", expect: "neither",
    css: "#staff-note{display:none !important}",
    note: "hides an element that is already display:none (systematic-pool equivalent)" },
  { id: "EQ2", page: "studio", category: "equivalent", expect: "neither",
    css: "#clip-light{display:none !important}",
    note: "hides the hidden overload light (systematic-pool equivalent)" },
];

const buildScenarios = () => {
  const all = [...MUTANTS, ...PROBES];
  return all.map((m) => ({
    label: m.id,
    url: BASE + PAGES[m.page],
    mutation: { css: m.css ?? null, action: m.action ?? null },
    delay: 400,
    onReadyScript: "onReady.cjs",
  }));
};

const runBackstop = (cmd, env = {}) =>
  new Promise((resolve) => {
    const proc = spawn("npx", ["backstop", cmd, `--config=${DIR}backstop.config.cjs`], {
      cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env },
    });
    // `backstop test` exits non-zero when scenarios mismatch; a mismatch IS
    // the measurement here, so the exit code is informational only.
    proc.on("exit", (code) => resolve(code));
  });

const main = async () => {
  writeFileSync(`${DIR}scenarios.json`, JSON.stringify(buildScenarios(), null, 2));
  rmSync(`${DIR}data`, { recursive: true, force: true });

  const server = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"], {
    cwd: ROOT, stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1200));

  try {
    console.log("── backstop reference (mutations OFF) ──");
    const refCode = await runBackstop("reference");
    if (refCode !== 0) throw new Error("reference run failed");
    console.log("── backstop test (mutations ON) ──");
    await runBackstop("test");
  } finally {
    server.kill();
  }

  const reportPath = `${DIR}data/json_report/jsonReport.json`;
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const catalog = new Map([...MUTANTS, ...PROBES].map((m) => [m.id, m]));
  const rows = report.tests.map((t) => {
    const m = catalog.get(t.pair.label);
    return {
      id: t.pair.label, page: m.page, category: m.category, expect: m.expect,
      backstopDetected: t.status === "fail",
      mismatchPercent: t.pair.diff?.misMatchPercentage ?? "0",
    };
  });

  const results = JSON.parse(readFileSync(new URL("./results.json", import.meta.url), "utf8"));
  const llVerdicts = new Map(results.mutants.map((m) => [m.id, m.detected]));
  const merged = rows.map((r) => ({
    ...r,
    layoutLintDetected: llVerdicts.get(r.id) ?? false,
  }));
  results.backstop = { scenarios: merged };
  writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(results, null, 2));

  console.log("\nid     category      layout-lint  backstop   mismatch%");
  for (const r of merged) {
    console.log(`${r.id.padEnd(6)} ${r.category.padEnd(13)} ${String(r.layoutLintDetected).padEnd(12)} ${String(r.backstopDetected).padEnd(10)} ${r.mismatchPercent}`);
  }
  console.log("\nwritten: scripts/eval/results.json (backstop section)");
};

// ── survivor cross-check (--survivors) ──────────────────────────────────
// Every systematic survivor re-runs as a Backstop scenario, so the pixel
// oracle independently checks each class (a flagged equivalent would
// falsify the classification). Writes results.json systematic.pixelCheck.

const survivorAction = (m) => {
  const o = OPERATORS.find((x) => x.op === m.op);
  const lines = o.props
    .map(([p, v]) => `el.style.setProperty(${JSON.stringify(p)}, ${JSON.stringify(v)}, "important");`)
    .join("\n    ");
  return `(async () => {
    const r = await window.layoutLintAuto.monitor.evaluateNow();
    const defs = r.definitions;
    ${pageHelpers}
    const el = resolveName(defs, ${JSON.stringify(m.target)});
    if (!el) return;
    ${o.relativeIfStatic ? 'if (getComputedStyle(el).position === "static") el.style.setProperty("position", "relative", "important");' : ""}
    ${lines}
  })()`;
};

const survivorsMain = async () => {
  const resultsUrl = new URL("./results.json", import.meta.url);
  const results = JSON.parse(readFileSync(resultsUrl, "utf8"));
  const survivors = results.systematic.mutants.filter((m) => !m.status && !m.detected);
  console.log(`survivor cross-check: ${survivors.length} scenarios`);

  const scenarios = survivors.map((m) => ({
    label: m.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
    url: BASE + PAGES[m.page],
    mutation: { css: null, action: survivorAction(m) },
    delay: 400,
    onReadyScript: "onReady.cjs",
  }));
  writeFileSync(`${DIR}scenarios-survivors.json`, JSON.stringify(scenarios, null, 2));
  rmSync(`${DIR}data-survivors`, { recursive: true, force: true });

  const env = { LL_BS_SCENARIOS: "./scenarios-survivors.json", LL_BS_DATA: "data-survivors" };
  const server = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"], {
    cwd: ROOT, stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1200));
  try {
    console.log("── backstop reference (survivors, mutations OFF) ──");
    const refCode = await runBackstop("reference", env);
    if (refCode !== 0) throw new Error("reference run failed");
    console.log("── backstop test (survivors, mutations ON) ──");
    await runBackstop("test", env);
  } finally {
    server.kill();
  }

  const report = JSON.parse(readFileSync(`${DIR}data-survivors/json_report/jsonReport.json`, "utf8"));
  const byLabel = new Map(report.tests.map((t) => [t.pair.label, t]));
  const rows = survivors.map((m) => {
    const t = byLabel.get(m.id.replace(/[^a-zA-Z0-9_-]/g, "_"));
    return {
      id: m.id, class: m.class,
      flagged: t ? t.status === "fail" : null,
      mismatchPercent: t?.pair.diff?.misMatchPercentage ?? "0",
    };
  });
  const perClass = {};
  for (const r of rows) {
    perClass[r.class] ??= { scenarios: 0, flagged: 0, maxMismatch: 0 };
    perClass[r.class].scenarios += 1;
    if (r.flagged) perClass[r.class].flagged += 1;
    perClass[r.class].maxMismatch = Math.max(perClass[r.class].maxMismatch, Number(r.mismatchPercent));
  }
  results.systematic.pixelCheck = {
    perClass,
    flagged: rows.filter((r) => r.flagged).map((r) => ({ id: r.id, class: r.class, mismatchPercent: r.mismatchPercent })),
    scenarios: rows,
  };
  writeFileSync(resultsUrl, JSON.stringify(results, null, 2));

  console.log("\nclass       scenarios  flagged  max mismatch%");
  for (const [c, s] of Object.entries(perClass)) {
    console.log(`${c.padEnd(11)} ${String(s.scenarios).padStart(9)} ${String(s.flagged).padStart(8)}  ${s.maxMismatch}`);
  }
  console.log("written: scripts/eval/results.json (systematic.pixelCheck)");
};

// Only run when invoked directly; verify scripts import PROBES from here.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (process.argv.includes("--survivors")) {
    await survivorsMain();
  } else {
    await main();
  }
}
