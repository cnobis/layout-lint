// Systematic mutant pool: a fixed operator grid applied to every
// element the specifications name, no per-mutant tuning. Names come from the
// monitor's own parsed rules and resolve through a mirror of the runtime's
// resolveWithDefinitions, so oracle and mutation target the same node; the
// fault is an inline !important style on it. Survivor classes, from rects
// recorded before/after: equivalent (no rect changed), blind-spot (restack,
// no rect changed), spec-gap (rects changed, no rule failed).
//
// Run: node scripts/eval/systematic.mjs [--page gallery]
// Full runs merge a `systematic` section into results.json; --page runs
// only print.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { PAGES } from "./mutations.mjs";

const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;
const RECT_EPSILON = 0.5; // px; a change below this is sub-pixel noise, not geometry

export const OPERATORS = [
  { op: "hide", props: [["display", "none"]] },
  { op: "shift-x", props: [["margin-left", "24px"]] },
  { op: "shift-y", props: [["margin-top", "24px"]] },
  { op: "shrink", props: [["width", "50px"]] },
  { op: "grow", props: [["width", "150%"]] },
  // Pure paint-order change: position:relative is added only when the
  // computed position is static (it makes z-index apply without moving the
  // box); positioned elements get the z-index change alone.
  { op: "restack", props: [["z-index", "-1"]], relativeIfStatic: true },
];

const startServer = () =>
  new Promise((resolve) => {
    const proc = spawn("npx", ["http-server", "-c-1", "-p", String(PORT), "--silent"], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdio: "ignore",
    });
    setTimeout(() => resolve(proc), 1200);
  });

// Serialized into the page: mirrors resolveWithDefinitions (runtime) /
// resolveElement (widget). `defs` is the live Map<alias, selector> returned
// by evaluateNow.
export const pageHelpers = `
  const resolveName = (defs, id) => {
    const sel = defs.get(id);
    if (sel) return document.querySelector(sel);
    for (const [name, wcSel] of defs) {
      if (!name.endsWith("*")) continue;
      const prefix = name.slice(0, -1);
      if (id.startsWith(prefix)) {
        const suffix = id.slice(prefix.length);
        const index = Number(suffix);
        if (Number.isInteger(index) && index >= 1) {
          const els = Array.from(document.querySelectorAll(wcSel));
          return els[index - 1] ?? null;
        }
      }
    }
    return document.getElementById(id);
  };
  const resolvePattern = (defs, pattern) => {
    const exact = defs.get(pattern);
    if (exact) return Array.from(document.querySelectorAll(exact));
    for (const [name, wcSel] of defs) {
      if (!name.endsWith("*")) continue;
      const prefix = name.slice(0, -1);
      if (pattern === name || pattern.startsWith(prefix)) {
        return Array.from(document.querySelectorAll(wcSel));
      }
    }
    const escaped = pattern.replace(/[|\\\\{}()[\\]^$+?.]/g, "\\\\$&")
      .replace(/\\*/g, ".*").replace(/#/g, "\\\\d+");
    const matcher = new RegExp("^" + escaped + "$");
    return Array.from(document.querySelectorAll("[id]")).filter((n) => matcher.test(n.id));
  };
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const rectsFor = (defs, names, patterns) => {
    const rects = {};
    for (const n of names) {
      const el = resolveName(defs, n);
      if (el) rects[n] = rectOf(el);
    }
    for (const p of patterns) {
      resolvePattern(defs, p).forEach((el, i) => { rects[p + "[" + i + "]"] = rectOf(el); });
    }
    return rects;
  };
`;

const settlePage = async (page) => {
  await page.waitForFunction(() => !!window.layoutLintAuto, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*{transition:none !important; animation:none !important}" });
};

// Enumerate what the spec names, and record which names actually resolve.
const enumeratePage = (page) =>
  page.evaluate(`(async () => {
    ${pageHelpers}
    const r = await window.layoutLintAuto.monitor.evaluateNow();
    const names = new Set();
    const patterns = new Set();
    for (const rule of r.rules) {
      if (rule.countPattern) patterns.add(rule.countPattern);
      for (const n of [rule.element, rule.target, rule.target2]) {
        if (n && !n.includes("*") && !n.includes("#")) names.add(n);
      }
    }
    const resolved = [];
    const unresolved = [];
    for (const n of names) (resolveName(r.definitions, n) ? resolved : unresolved).push(n);
    const patternInfo = [...patterns].map((p) => ({
      pattern: p, members: resolvePattern(r.definitions, p).length,
    }));
    return { resolved: resolved.sort(), unresolved: unresolved.sort(), patterns: patternInfo };
  })()`);

// One mutant: capture rects, inject on the resolved node, re-evaluate,
// capture rects again. Runs in a single page.evaluate on a fresh load.
const runInjection = (page, { targetName, targetPattern, props, relativeIfStatic, names, patterns }) =>
  page.evaluate(`(async () => {
    ${pageHelpers}
    const cfg = ${JSON.stringify({ targetName, targetPattern, props, relativeIfStatic: !!relativeIfStatic, names, patterns })};
    const before = await window.layoutLintAuto.monitor.evaluateNow();
    const defs = before.definitions;
    const el = cfg.targetPattern
      ? resolvePattern(defs, cfg.targetPattern)[0]
      : resolveName(defs, cfg.targetName);
    if (!el) return { applied: false };
    const rectsBefore = rectsFor(defs, cfg.names, cfg.patterns);
    if (cfg.relativeIfStatic && getComputedStyle(el).position === "static") {
      el.style.setProperty("position", "relative", "important");
    }
    for (const [prop, value] of cfg.props) el.style.setProperty(prop, value, "important");
    const after = await window.layoutLintAuto.monitor.evaluateNow();
    const verdicts = after.results.map(({ element, relation, negated, target, pass, reason }) => ({
      element, relation, negated: !!negated, target: target ?? null, pass, reason: reason ?? null,
    }));
    const rectsAfter = rectsFor(defs, cfg.names, cfg.patterns);
    return { applied: true, verdicts, rectsBefore, rectsAfter };
  })()`);

const changedRects = (before, after) => {
  const changed = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (!a || !b) { changed.push(key); continue; }
    if (["x", "y", "w", "h"].some((k) => Math.abs(a[k] - b[k]) > RECT_EPSILON)) changed.push(key);
  }
  return changed;
};

const classify = (m) => {
  if (m.detected) return "detected";
  if (m.rectsChanged.length === 0) return m.op === "restack" ? "blind-spot" : "equivalent";
  return "spec-gap";
};

const main = async () => {
  const pageFilter = process.argv.includes("--page")
    ? process.argv[process.argv.indexOf("--page") + 1]
    : null;
  const pages = Object.entries(PAGES).filter(([name]) => !pageFilter || name === pageFilter);
  if (!pages.length) throw new Error(`unknown page filter: ${pageFilter}`);

  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const report = { pages: {}, mutants: [], summary: {}, taxonomy: {} };

  try {
    for (const [pageName, path] of pages) {
      // ── baseline gate + enumeration ──
      const page = await context.newPage();
      await page.goto(BASE + path, { waitUntil: "load" });
      await settlePage(page);
      const baseline = await page.evaluate(async () => {
        const r = await window.layoutLintAuto.monitor.evaluateNow();
        return r.results.map(({ element, relation, negated, target, pass, reason }) => ({
          element, relation, negated: !!negated, target: target ?? null, pass, reason: reason ?? null,
        }));
      });
      const failing = baseline.filter((v) => !v.pass);
      const named = await enumeratePage(page);
      await page.close();
      report.pages[pageName] = {
        path, rules: baseline.length, baselineAllPass: failing.length === 0,
        elements: named.resolved.length, unresolvedNames: named.unresolved,
        countPatterns: named.patterns,
      };
      console.log(`${pageName}: ${baseline.length} rules, ${named.resolved.length} named elements, ` +
        `${named.patterns.length} count patterns${failing.length ? " — BASELINE NOT CLEAN, SKIPPING" : ""}`);
      if (named.unresolved.length) console.log(`  unresolved names (skipped): ${named.unresolved.join(", ")}`);
      if (failing.length) continue;

      // ── the grid: every named element × every operator ──
      const jobs = [];
      for (const name of named.resolved) {
        for (const o of OPERATORS) {
          jobs.push({ id: `SYS-${pageName}:${name}:${o.op}`, targetName: name, ...o });
        }
      }
      // Count-pattern extension: hide one resolved member per pattern.
      for (const { pattern, members } of named.patterns) {
        if (members > 0) {
          jobs.push({
            id: `SYS-${pageName}:${pattern}[0]:hide`, targetPattern: pattern,
            op: "hide", props: [["display", "none"]],
          });
        }
      }

      for (const job of jobs) {
        const p = await context.newPage();
        await p.goto(BASE + path, { waitUntil: "load" });
        await settlePage(p);
        const out = await runInjection(p, {
          targetName: job.targetName, targetPattern: job.targetPattern,
          props: job.props, relativeIfStatic: job.relativeIfStatic,
          names: named.resolved, patterns: named.patterns.map((x) => x.pattern),
        });
        await p.close();
        if (!out.applied) {
          report.mutants.push({ id: job.id, page: pageName, op: job.op, status: "target did not resolve" });
          console.log(`${job.id}: TARGET DID NOT RESOLVE`);
          continue;
        }
        const newlyFailing = out.verdicts
          .map((v, i) => ({ v, i }))
          .filter(({ v, i }) => !v.pass && baseline[i]?.pass)
          .map(({ v, i }) => `${i}:${v.element} ${v.negated ? "not " : ""}${v.relation}${v.target ? " " + v.target : ""}`);
        const m = {
          id: job.id, page: pageName, op: job.op,
          target: job.targetName ?? `${job.targetPattern}[0]`,
          detected: newlyFailing.length > 0, newlyFailing,
          rectsChanged: changedRects(out.rectsBefore, out.rectsAfter),
        };
        m.class = classify(m);
        report.mutants.push(m);
        console.log(`${m.id} ${m.detected ? "DETECTED" : "survived → " + m.class} ` +
          `(${newlyFailing.length} rules, ${m.rectsChanged.length} rects moved)`);
      }
    }

    // ── summary ──
    const ran = report.mutants.filter((m) => !m.status);
    const byOp = {};
    for (const m of ran) {
      byOp[m.op] ??= { mutants: 0, detected: 0, equivalent: 0, "blind-spot": 0, "spec-gap": 0 };
      byOp[m.op].mutants += 1;
      byOp[m.op][m.class === "detected" ? "detected" : m.class] += 1;
    }
    report.summary = {
      byOperator: byOp,
      total: ran.length,
      detected: ran.filter((m) => m.detected).length,
    };
    report.taxonomy = {
      equivalent: ran.filter((m) => m.class === "equivalent").map((m) => m.id),
      "blind-spot": ran.filter((m) => m.class === "blind-spot").map((m) => m.id),
      "spec-gap": ran.filter((m) => m.class === "spec-gap").map((m) => m.id),
    };

    console.log("\noperator   mutants  detected  equivalent  blind-spot  spec-gap");
    for (const [op, s] of Object.entries(byOp)) {
      console.log(`${op.padEnd(10)} ${String(s.mutants).padStart(7)} ${String(s.detected).padStart(9)}` +
        ` ${String(s.equivalent).padStart(11)} ${String(s["blind-spot"]).padStart(11)} ${String(s["spec-gap"]).padStart(9)}`);
    }
    console.log(`\ntotal: ${report.summary.detected}/${report.summary.total} detected`);
  } finally {
    await browser.close();
    server.kill();
  }

  if (pageFilter) {
    console.log("\n(--page run: results.json not touched)");
    return;
  }
  const resultsUrl = new URL("./results.json", import.meta.url);
  const existing = JSON.parse(readFileSync(resultsUrl, "utf8"));
  existing.systematic = report;
  writeFileSync(resultsUrl, JSON.stringify(existing, null, 2));
  console.log("written: scripts/eval/results.json (systematic section)");
};

// Only run when invoked directly; run-backstop.mjs imports OPERATORS/pageHelpers.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  await main();
}
