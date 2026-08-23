// targeted fault-injection study: inject each catalog mutant into its demo
// page and check whether a rule that passed at baseline fails afterwards.
//
// run this first: run-backstop.mjs and galen-run.mjs read the mutants section
// it writes, then merge their own sections alongside it.
//
// run: node scripts/eval/run-mutations.mjs   (writes results.json)
import { readFileSync, writeFileSync } from "node:fs";
import { PAGES, MUTANTS } from "./mutations.mjs";
import { serve, launchBrowser, openPage, verdicts, newlyFailing } from "./helpers.mjs";
import { stamp } from "./version.mjs";

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

const server = await serve(PORT);
const { browser, context } = await launchBrowser();
const report = { pages: {}, mutants: [], summary: {} };
const baselines = {};

try {
  // every page must pass untouched before its mutants count for anything
  for (const [name, path] of Object.entries(PAGES)) {
    const page = await openPage(context, BASE + path);
    const base = await verdicts(page);
    await page.close();
    const failing = base.filter((v) => !v.pass);
    baselines[name] = base;
    report.pages[name] = { path, rules: base.length, baselineAllPass: failing.length === 0 };
    console.log(`baseline ${name}: ${base.length} verdicts, ${failing.length} failing`);
    for (const f of failing) console.log(`  BASELINE FAIL: ${f.element} ${f.relation}`);
  }

  for (const m of MUTANTS) {
    if (!report.pages[m.page].baselineAllPass) {
      report.mutants.push({ id: m.id, page: m.page, status: "skipped, baseline not clean" });
      continue;
    }
    const page = await openPage(context, BASE + PAGES[m.page]);
    if (m.css) await page.addStyleTag({ content: m.css });
    if (m.action) await page.evaluate(m.action);
    const after = await verdicts(page);
    await page.close();
    const failed = newlyFailing(baselines[m.page], after);
    report.mutants.push({
      id: m.id,
      page: m.page,
      category: m.category,
      expect: m.expect,
      detected: failed.length > 0,
      failedRules: failed,
    });
    console.log(`${m.id} [${m.category}] ${failed.length ? "DETECTED" : "survived"} (${failed.length} rules)`);
  }

  // per-category tally, plus a check against each mutant's stated expectation
  let ran = 0;
  let detected = 0;
  let mismatches = 0;
  for (const m of report.mutants) {
    if (m.status) continue;
    ran += 1;
    if (m.detected) detected += 1;
    report.summary[m.category] ??= { mutants: 0, detected: 0 };
    report.summary[m.category].mutants += 1;
    if (m.detected) report.summary[m.category].detected += 1;
    if (m.detected !== (m.expect === "killed")) {
      mismatches += 1;
      console.log(`MISMATCH ${m.id}: expected ${m.expect}`);
    }
  }
  console.log(`\ntargeted: ${detected}/${ran} detected, ${mismatches} mismatches against the catalog`);
} finally {
  await browser.close();
  server.kill();
}

// merge rather than overwrite: the backstop and galen sections are written by
// their own scripts and must survive a re-run of this one
const resultsUrl = new URL("./results.json", import.meta.url);
let existing = {};
try {
  existing = JSON.parse(readFileSync(resultsUrl, "utf8"));
} catch {
  // first run, or the file was removed on purpose
}
const merged = { ...existing, ...report, layoutLint: stamp() };
writeFileSync(resultsUrl, JSON.stringify(merged, null, 2));
console.log("written: scripts/eval/results.json");
