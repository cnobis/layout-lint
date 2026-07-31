// Spec-size scaling benchmark for the layout-lint pipeline (Node, no browser).
//
// Method: generates specifications of 10/50/100/250/500 rules (cycling four
// rule forms: `below`, `aligned-left`, `same-width`, `width`) and runs them
// against a stub document of 60 elements whose getBoundingClientRect returns
// fixed rectangles. Every element resolves, so the full measure-and-compare
// path runs; the stub computes no layout, so the figures cover the pipeline's
// own work, not the browser's measurement calls.
//
// Reported: median parse / evaluate / full-run times over 60 iterations,
// plus the cold first run (WASM init + parse + eval). Feeds Table 8 of the
// thesis ("Median parse and evaluation times ...").
//
// Run: npm run build:ts && node scripts/bench-spec-scaling.mjs
import { runLayoutLint, parseSpec, evaluateParsedSpec } from '../dist/index.js';

const M = 60;
function fakeRect(i) {
  const top = (i % 20) * 50, left = (i % 10) * 120;
  return { top, left, bottom: top + 40, right: left + 100, width: 100, height: 40, x: left, y: top };
}
const els = new Map();
for (let i = 0; i < M; i++) {
  els.set(`e${i}`, { getBoundingClientRect: () => fakeRect(i), id: `e${i}` });
}
globalThis.document = {
  getElementById: id => els.get(id) ?? null,
  querySelector: () => null,
  querySelectorAll: () => [],
};

function genSpec(n) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = `e${i % M}`, b = `e${(i + 7) % M}`;
    switch (i % 4) {
      case 0: lines.push(`${a} below ${b} 10px;`); break;
      case 1: lines.push(`${a} aligned-left ${b};`); break;
      case 2: lines.push(`${a} same-width ${b};`); break;
      case 3: lines.push(`${a} width 100px;`); break;
    }
  }
  return lines.join('\n');
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const t0 = performance.now();
await runLayoutLint({ specText: 'e0 below e1;' });
console.log(`cold first run (init+parse+eval): ${(performance.now() - t0).toFixed(1)} ms`);
console.log('N\tparse_ms\teval_ms\tfull_ms\tpass/total');
for (const n of [10, 50, 100, 250, 500]) {
  const spec = genSpec(n);
  const parseT = [], evalT = [], fullT = [];
  let passInfo = '';
  for (let iter = 0; iter < 60; iter++) {
    let t = performance.now();
    const parsed = await parseSpec({ specText: spec });
    parseT.push(performance.now() - t);
    t = performance.now();
    const res = evaluateParsedSpec(parsed);
    evalT.push(performance.now() - t);
    t = performance.now();
    await runLayoutLint({ specText: spec });
    fullT.push(performance.now() - t);
    if (iter === 0) {
      passInfo = `${res.results.filter(r => r.pass).length}/${res.results.length}`;
    }
  }
  console.log(`${n}\t${median(parseT).toFixed(2)}\t${median(evalT).toFixed(2)}\t${median(fullT).toFixed(2)}\t${passInfo}`);
}
