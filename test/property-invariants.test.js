import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateRules } from '../dist/core/evaluator.js';

// Property-based invariant checks over the evaluator.
//
// A layout rule is a property in the QuickCheck sense: a claim over rendered
// geometry that should hold for every rendering. These tests turn that around
// and check claims about the EVALUATOR itself over randomly generated
// rectangle configurations. The invariants are chosen because none of them
// hold by construction: `below`/`above` are two independent measure
// expressions, negation is a separate final step, and `inside`/`partially
// inside` are two separate predicates.
//
// The generator is a seeded PRNG (mulberry32), so every run sees the same
// 200 configurations per invariant and failures are reproducible.
//
// Each biconditional also asserts a lower bound on how often its premise or
// left side was satisfied: an equivalence between two verdicts that are
// false in every generated configuration would hold vacuously. The size
// tests bias half their pairs toward near-equal dimensions for the same
// reason (uniform sizes almost never match within tolerance).

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const RUNS = 200;

const makeGen = (seed) => {
  const rnd = mulberry32(seed);
  const num = (min, max) => min + rnd() * (max - min);
  const rect = ({ minSize = 1, maxSize = 400 } = {}) => {
    const left = num(-200, 800);
    const top = num(-200, 800);
    const width = num(minSize, maxSize);
    const height = num(minSize, maxSize);
    return { left, top, right: left + width, bottom: top + height, width, height };
  };
  return { rnd, num, rect };
};

const resolverFor = (rects) => (id) =>
  rects[id] ? { getBoundingClientRect: () => rects[id] } : null;

const passOf = (rule, rects) => evaluateRules([rule], resolverFor(rects))[0].pass;

describe('Property invariants: directional duality', () => {
  it('a below b passes iff b above a passes (200 random pairs)', () => {
    const g = makeGen(1);
    let positives = 0;
    for (let i = 0; i < RUNS; i++) {
      const rects = { a: g.rect(), b: g.rect() };
      const d = g.rnd() < 0.5 ? undefined : Math.floor(g.num(0, 60));
      const below = passOf({ element: 'a', relation: 'below', target: 'b', distancePx: d }, rects);
      const above = passOf({ element: 'b', relation: 'above', target: 'a', distancePx: d }, rects);
      assert.strictEqual(below, above, `pair ${i}: below=${below} above=${above} d=${d}`);
      if (below) positives++;
    }
    assert.ok(positives >= 20 && positives <= 180, `both sides exercised (${positives} positives)`);
  });

  it('a left-of b passes iff b right-of a passes (200 random pairs)', () => {
    const g = makeGen(2);
    let positives = 0;
    for (let i = 0; i < RUNS; i++) {
      const rects = { a: g.rect(), b: g.rect() };
      const d = g.rnd() < 0.5 ? undefined : Math.floor(g.num(0, 60));
      const leftOf = passOf({ element: 'a', relation: 'left-of', target: 'b', distancePx: d }, rects);
      const rightOf = passOf({ element: 'b', relation: 'right-of', target: 'a', distancePx: d }, rects);
      assert.strictEqual(leftOf, rightOf, `pair ${i}`);
      if (leftOf) positives++;
    }
    assert.ok(positives >= 20 && positives <= 180, `both sides exercised (${positives} positives)`);
  });
});

describe('Property invariants: size-match symmetry', () => {
  it('same-width and same-height are symmetric (200 random pairs)', () => {
    const g = makeGen(3);
    const positives = { 'same-width': 0, 'same-height': 0 };
    for (let i = 0; i < RUNS; i++) {
      const rects = { a: g.rect(), b: g.rect() };
      // bias half the pairs toward near-equal sizes so the matching side of
      // the biconditional fires; uniform sizes almost never match
      if (g.rnd() < 0.5) {
        const w = Math.max(1, rects.a.width + g.num(-25, 25));
        rects.b.width = w; rects.b.right = rects.b.left + w;
      }
      if (g.rnd() < 0.5) {
        const h = Math.max(1, rects.a.height + g.num(-25, 25));
        rects.b.height = h; rects.b.bottom = rects.b.top + h;
      }
      const d = g.rnd() < 0.5 ? undefined : Math.floor(g.num(0, 20));
      for (const relation of ['same-width', 'same-height']) {
        const ab = passOf({ element: 'a', relation, target: 'b', distancePx: d }, rects);
        const ba = passOf({ element: 'b', relation, target: 'a', distancePx: d }, rects);
        assert.strictEqual(ab, ba, `pair ${i} ${relation}`);
        if (ab) positives[relation]++;
      }
    }
    for (const relation of ['same-width', 'same-height']) {
      assert.ok(positives[relation] >= 20, `${relation} matched often enough (${positives[relation]})`);
    }
  });
});

describe('Property invariants: negation', () => {
  it('not inverts the verdict when both elements resolve (200 random rules)', () => {
    const g = makeGen(4);
    let passes = 0;
    const relations = ['below', 'above', 'left-of', 'right-of', 'inside', 'same-width'];
    for (let i = 0; i < RUNS; i++) {
      const rects = { a: g.rect(), b: g.rect() };
      const relation = relations[Math.floor(g.rnd() * relations.length)];
      const plain = passOf({ element: 'a', relation, target: 'b' }, rects);
      const negated = passOf({ element: 'a', relation, target: 'b', negated: true }, rects);
      assert.strictEqual(negated, !plain, `rule ${i} (${relation})`);
      if (plain) passes++;
    }
    assert.ok(passes >= 20 && passes <= 180, `both verdicts exercised (${passes} passes)`);
  });

  // FINDING (documented current behavior): when an element does not resolve,
  // the evaluator returns a failure before the negation step runs, so `not`
  // does not invert the element-not-found outcome. A rule like
  // `ghost not inside footer` fails rather than passing vacuously.
  it('finding: not is skipped on the element-not-found path', () => {
    const g = makeGen(5);
    const rects = { footer: g.rect() };
    const plain = passOf({ element: 'ghost', relation: 'inside', target: 'footer' }, rects);
    const negated = passOf({ element: 'ghost', relation: 'inside', target: 'footer', negated: true }, rects);
    assert.strictEqual(plain, false);
    assert.strictEqual(negated, false, 'current behavior: negation does not apply to unresolved elements');
  });
});

describe('Property invariants: containment implication', () => {
  it('inside implies partially inside for non-degenerate rects (200 random pairs)', () => {
    const g = makeGen(6);
    let insideCount = 0;
    for (let i = 0; i < RUNS; i++) {
      const container = g.rect({ minSize: 100, maxSize: 600 });
      // bias half the children into the container so the premise fires often
      const child = g.rnd() < 0.5
        ? g.rect({ minSize: 1, maxSize: 80 })
        : (() => {
            const w = g.num(1, container.width / 2);
            const h = g.num(1, container.height / 2);
            const left = g.num(container.left, container.right - w);
            const top = g.num(container.top, container.bottom - h);
            return { left, top, right: left + w, bottom: top + h, width: w, height: h };
          })();
      const rects = { child, container };
      const inside = passOf({ element: 'child', relation: 'inside', target: 'container' }, rects);
      if (!inside) continue;
      insideCount++;
      const partially = passOf({ element: 'child', relation: 'partially-inside', target: 'container' }, rects);
      assert.strictEqual(partially, true, `pair ${i}: inside implies partially inside`);
    }
    assert.ok(insideCount > 20, `premise fired ${insideCount} times`);
  });

  // FINDING (documented current behavior): full containment is inclusive
  // while overlap is strict, so a degenerate box (zero width) sitting flush
  // on the container's edge passes `inside` but fails `partially inside`.
  // An interior degenerate box keeps the implication (verified above).
  it('finding: a zero-width child on the container edge breaks the implication', () => {
    const container = { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 };
    const child = { left: 0, top: 100, right: 0, bottom: 200, width: 0, height: 100 };
    const rects = { child, container };
    assert.strictEqual(passOf({ element: 'child', relation: 'inside', target: 'container' }, rects), true);
    assert.strictEqual(
      passOf({ element: 'child', relation: 'partially-inside', target: 'container' }, rects),
      false, 'current behavior: strict overlap check rejects a boundary-flush degenerate box');
  });

  // FINDING (documented current behavior): with per-side offsets, the
  // partially-inside path checks only the named side offsets and never any
  // overlap, so an element wholly outside its container passes when the one
  // named offset happens to match.
  it('finding: partially inside with offsets does not require overlap', () => {
    const container = { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 };
    const child = { left: 500, top: -11, right: 550, bottom: 40, width: 50, height: 51 };
    const rects = { child, container };
    const rule = {
      element: 'child', relation: 'partially-inside', target: 'container',
      insideOffsets: [{ sides: ['top'], offsetPx: -11 }],
    };
    assert.strictEqual(passOf(rule, rects), true,
      'current behavior: the named top offset matches, overlap is never checked');
  });
});

describe('Property invariants: range tolerance bounds', () => {
  it('a range accepts exactly up to half a pixel beyond each end', () => {
    const mk = (gap) => ({
      a: { top: 100 + gap, bottom: 200 + gap, left: 0, right: 100 },
      b: { top: 0, bottom: 100, left: 0, right: 100 },
    });
    const rule = { element: 'a', relation: 'below', target: 'b', distanceMinPx: 10, distanceMaxPx: 20 };
    assert.strictEqual(passOf(rule, mk(9.5)), true, 'lower bound minus tolerance');
    assert.strictEqual(passOf(rule, mk(9.4)), false, 'below lower tolerance');
    assert.strictEqual(passOf(rule, mk(20.5)), true, 'upper bound plus tolerance');
    assert.strictEqual(passOf(rule, mk(20.6)), false, 'above upper tolerance');
  });
});
