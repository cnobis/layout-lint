// generated mutant pool: every element the specifications name receives the
// same six perturbations, with no per-mutant tuning. survivors are classified
// from the rectangles of all named elements, recorded before and after each
// injection: equivalent when nothing moved, blind-spot when nothing moved and
// the operator was restack, spec-gap when geometry moved and no rule failed.
//
// run: node scripts/eval/systematic.mjs   (merges into results.json)
import { readFileSync, writeFileSync } from "node:fs";
import { PAGES } from "./mutations.mjs";
import { serve, launchBrowser, openPage, verdicts, newlyFailing } from "./helpers.mjs";

const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;

// a rect change below half a pixel is rendering noise, not geometry
const RECT_EPSILON = 0.5;

const OPERATORS = [
  { op: "hide", prop: "display", value: "none" },
  { op: "shift-x", prop: "margin-left", value: "24px" },
  { op: "shift-y", prop: "margin-top", value: "24px" },
  { op: "shrink", prop: "width", value: "50px" },
  { op: "grow", prop: "width", value: "150%" },
  // a pure paint-order change: position:relative is added only when the
  // element is static, so z-index applies without moving the box
  { op: "restack", prop: "z-index", value: "-1", relativeIfStatic: true },
];

// runs inside the page: resolves a spec name to its element the same way the
// runtime does, defined aliases first, wildcard defines with a numeric
// suffix second, element ids last
function installResolver() {
  window.evalResolve = (defs, id) => {
    const sel = defs.get(id);
    if (sel) return document.querySelector(sel);
    for (const [name, wildcardSel] of defs) {
      if (!name.endsWith("*")) continue;
      const prefix = name.slice(0, -1);
      if (id.startsWith(prefix)) {
        const index = Number(id.slice(prefix.length));
        if (Number.isInteger(index) && index >= 1) {
          return document.querySelectorAll(wildcardSel)[index - 1] ?? null;
        }
      }
    }
    return document.getElementById(id);
  };
}

// runs inside the page: which plain names do the rules use, and which resolve
const enumerateNames = async () => {
  const r = await window.layoutLintAuto.monitor.evaluateNow();
  const names = new Set();
  for (const rule of r.rules) {
    for (const n of [rule.element, rule.target, rule.target2]) {
      if (n && !n.includes("*") && !n.includes("#")) names.add(n);
    }
  }
  const resolved = [];
  for (const n of [...names].sort()) {
    if (window.evalResolve(r.definitions, n)) resolved.push(n);
  }
  return resolved;
};

// runs inside the page: rects of all named elements, the injection, rects
// again, and the verdicts after it
const injectAndMeasure = async (cfg) => {
  const rectsOf = (defs) => {
    const rects = {};
    for (const n of cfg.names) {
      const el = window.evalResolve(defs, n);
      if (el) {
        const r = el.getBoundingClientRect();
        rects[n] = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
    }
    return rects;
  };
  const before = await window.layoutLintAuto.monitor.evaluateNow();
  const el = window.evalResolve(before.definitions, cfg.target);
  if (!el) return { applied: false };
  const rectsBefore = rectsOf(before.definitions);
  if (cfg.relativeIfStatic && getComputedStyle(el).position === "static") {
    el.style.setProperty("position", "relative", "important");
  }
  el.style.setProperty(cfg.prop, cfg.value, "important");
  const after = await window.layoutLintAuto.monitor.evaluateNow();
  const rectsAfter = rectsOf(before.definitions);
  const results = after.results.map((v) => ({
    element: v.element, relation: v.relation, negated: !!v.negated,
    target: v.target ?? null, pass: v.pass,
  }));
  return { applied: true, results, rectsBefore, rectsAfter };
};

const rectsMoved = (before, after) => {
  let moved = 0;
  for (const key of Object.keys(before)) {
    const a = before[key];
    const b = after[key];
    if (!b) { moved += 1; continue; }
    if (Math.abs(a.x - b.x) > RECT_EPSILON || Math.abs(a.y - b.y) > RECT_EPSILON ||
        Math.abs(a.w - b.w) > RECT_EPSILON || Math.abs(a.h - b.h) > RECT_EPSILON) moved += 1;
  }
  return moved;
};

const server = await serve(PORT);
const { browser, context } = await launchBrowser();
const report = { pages: {}, mutants: [], summary: {} };

try {
  for (const [pageName, path] of Object.entries(PAGES)) {
    const page = await openPage(context, BASE + path);
    await page.evaluate(installResolver);
    const baseline = await verdicts(page);
    const names = await page.evaluate(enumerateNames);
    await page.close();
    const failing = baseline.filter((v) => !v.pass).length;
    report.pages[pageName] = { path, rules: baseline.length, elements: names.length };
    console.log(`${pageName}: ${baseline.length} rules, ${names.length} named elements${failing ? " — BASELINE NOT CLEAN, SKIPPING" : ""}`);
    if (failing) continue;

    for (const name of names) {
      for (const o of OPERATORS) {
        const p = await openPage(context, BASE + path);
        await p.evaluate(installResolver);
        const out = await p.evaluate(injectAndMeasure, {
          target: name, prop: o.prop, value: o.value,
          relativeIfStatic: !!o.relativeIfStatic, names,
        });
        await p.close();
        const id = `SYS-${pageName}:${name}:${o.op}`;
        if (!out.applied) {
          report.mutants.push({ id, page: pageName, op: o.op, status: "target did not resolve" });
          continue;
        }
        const failed = newlyFailing(baseline, out.results);
        const moved = rectsMoved(out.rectsBefore, out.rectsAfter);
        const cls = failed.length > 0 ? "detected"
          : moved === 0 ? (o.op === "restack" ? "blind-spot" : "equivalent")
          : "spec-gap";
        report.mutants.push({
          id, page: pageName, op: o.op, target: name,
          detected: cls === "detected", class: cls, rectsMoved: moved, failedRules: failed,
        });
        console.log(`${id} ${cls === "detected" ? "DETECTED" : "survived → " + cls} (${failed.length} rules, ${moved} rects moved)`);
      }
    }
  }

  // per-operator tally
  const byOp = {};
  let total = 0;
  let detected = 0;
  for (const m of report.mutants) {
    if (m.status) continue;
    total += 1;
    if (m.detected) detected += 1;
    byOp[m.op] ??= { mutants: 0, detected: 0, equivalent: 0, "blind-spot": 0, "spec-gap": 0 };
    byOp[m.op].mutants += 1;
    byOp[m.op][m.class] += 1;
  }
  report.summary = { byOperator: byOp, total, detected };
  console.log("\noperator   mutants  detected  equivalent  blind-spot  spec-gap");
  for (const [op, s] of Object.entries(byOp)) {
    console.log(`${op.padEnd(10)} ${String(s.mutants).padStart(7)} ${String(s.detected).padStart(9)}` +
      ` ${String(s.equivalent).padStart(11)} ${String(s["blind-spot"]).padStart(11)} ${String(s["spec-gap"]).padStart(9)}`);
  }
  console.log(`\ntotal: ${detected}/${total} detected`);
} finally {
  await browser.close();
  server.kill();
}

const resultsUrl = new URL("./results.json", import.meta.url);
const results = JSON.parse(readFileSync(resultsUrl, "utf8"));
results.systematic = report;
writeFileSync(resultsUrl, JSON.stringify(results, null, 2));
console.log("written: scripts/eval/results.json (systematic section)");
