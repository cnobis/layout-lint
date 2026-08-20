// Fault-injection driver for the targeted mutation study.
//
// Method: for each demo page, load it unmutated and record the baseline
// verdicts (every rule must pass, otherwise the page is reported and its
// mutants are skipped). Then, for each mutant, reload the page fresh, inject
// the single fault (a CSS override or a DOM action), re-evaluate through the
// page's own monitor, and diff the verdicts against the baseline. A mutant is
// DETECTED when at least one rule that passed at baseline now fails.
//
// The pages are served by a child http-server on port 8123 and evaluated in
// headless Chromium via Playwright. Verdicts come from the page's own
// window.layoutLintAuto.monitor.evaluateNow(), i.e. the exact browser-side
// measurement path the shipped library uses.
//
// Run: node scripts/eval/run-mutations.mjs   (writes scripts/eval/results.json)
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { PAGES, MUTANTS } from "./mutations.mjs";

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

const startServer = () =>
  new Promise((resolve) => {
    const proc = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdio: "ignore",
    });
    setTimeout(() => resolve(proc), 1200);
  });

const collectVerdicts = async (page) => {
  await page.waitForFunction(() => !!window.layoutLintAuto, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async () => {
    const r = await window.layoutLintAuto.monitor.evaluateNow();
    return r.results.map(({ element, relation, negated, target, actual, pass, reason }) => ({
      element, relation, negated: !!negated, target: target ?? null,
      actual: actual ?? null, pass, reason: reason ?? null,
    }));
  });
};

const ruleKey = (v, i) => `${i}:${v.element} ${v.negated ? "not " : ""}${v.relation}${v.target ? " " + v.target : ""}`;

const main = async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const baselines = {};
  const report = { startedAt: null, pages: {}, mutants: [], summary: {} };

  try {
    // ── baselines ──
    for (const [name, path] of Object.entries(PAGES)) {
      const page = await context.newPage();
      await page.goto(BASE + path, { waitUntil: "load" });
      const verdicts = await collectVerdicts(page);
      const failing = verdicts.filter((v) => !v.pass);
      baselines[name] = verdicts;
      report.pages[name] = {
        path, rules: verdicts.length, baselineAllPass: failing.length === 0,
        baselineFailures: failing.map((v, i) => ({ rule: `${v.element} ${v.relation}`, reason: v.reason })),
      };
      console.log(`baseline ${name}: ${verdicts.length} verdicts, ${failing.length} failing`);
      if (failing.length) for (const f of failing) console.log(`  BASELINE FAIL: ${f.element} ${f.relation} — ${f.reason ?? ""}`);
      await page.close();
    }

    // ── mutants ──
    for (const m of MUTANTS) {
      if (!report.pages[m.page].baselineAllPass) {
        report.mutants.push({ ...m, status: "skipped (baseline not clean)" });
        continue;
      }
      const page = await context.newPage();
      await page.goto(BASE + PAGES[m.page], { waitUntil: "load" });
      await page.waitForFunction(() => !!window.layoutLintAuto, null, { timeout: 15000 });
      // Measure end states, not animation frames: the demo pages animate some
      // properties (e.g. the sidebar collapse transition), and a rect read
      // mid-transition would understate the injected fault.
      await page.addStyleTag({ content: "*{transition:none !important; animation:none !important}" });
      if (m.css) await page.addStyleTag({ content: m.css });
      if (m.action) await page.evaluate(m.action);
      const verdicts = await collectVerdicts(page);
      const base = baselines[m.page];
      const newlyFailing = verdicts
        .map((v, i) => ({ v, i }))
        .filter(({ v, i }) => !v.pass && base[i]?.pass)
        .map(({ v, i }) => ruleKey(v, i));
      const detected = newlyFailing.length > 0;
      report.mutants.push({
        id: m.id, page: m.page, category: m.category, expect: m.expect, note: m.note,
        mutation: m.css ?? m.action, detected, newlyFailing,
      });
      console.log(`${m.id} [${m.category}] ${detected ? "DETECTED" : "survived"} (${newlyFailing.length} rules)${m.expect === "survives" ? "  [expected to survive]" : ""}`);
      await page.close();
    }

    // ── summary ──
    const byCat = {};
    for (const m of report.mutants) {
      if (m.status) continue;
      byCat[m.category] ??= { mutants: 0, detected: 0 };
      byCat[m.category].mutants += 1;
      if (m.detected) byCat[m.category].detected += 1;
    }
    report.summary = byCat;
    console.log("\ncategory        mutants  detected");
    for (const [cat, s] of Object.entries(byCat)) {
      console.log(`${cat.padEnd(15)} ${String(s.mutants).padStart(7)} ${String(s.detected).padStart(9)}`);
    }
    const surprises = report.mutants.filter((m) => !m.status &&
      ((m.expect === "killed" && !m.detected) || (m.expect === "survives" && m.detected)));
    if (surprises.length) {
      console.log("\nHYPOTHESIS MISMATCHES:");
      for (const m of surprises) console.log(`  ${m.id}: expected ${m.expect}, got ${m.detected ? "detected" : "survived"} — ${m.note}`);
    }
  } finally {
    await browser.close();
    server.kill();
  }

  writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(report, null, 2));
  console.log("\nwritten: scripts/eval/results.json");
};

await main();
