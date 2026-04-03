import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseDistanceToken, parsePercentageToken } from '../dist/core/dsl.js';

describe('Distance Parsing', () => {
  it('should parse exact pixel distances with flexible spacing', () => {
    assert.deepStrictEqual(parseDistanceToken('10px'), { distancePx: 10 });
    assert.deepStrictEqual(parseDistanceToken('10 px'), { distancePx: 10 });
    assert.deepStrictEqual(parseDistanceToken('  10   px  '), { distancePx: 10 });
  });

  it('should parse ranged distances and keep inclusive bounds', () => {
    assert.deepStrictEqual(parseDistanceToken('5 to 15px'), {
      distanceMinPx: 5,
      distanceMaxPx: 15
    });
    assert.deepStrictEqual(parseDistanceToken('  5   to   15 px '), {
      distanceMinPx: 5,
      distanceMaxPx: 15
    });
  });

  it('should parse exact and ranged percentages', () => {
    assert.deepStrictEqual(parsePercentageToken('100%'), { distancePct: 100 });
    assert.deepStrictEqual(parsePercentageToken('95 to 100%'), {
      distanceMinPct: 95,
      distanceMaxPct: 100
    });
    assert.deepStrictEqual(parsePercentageToken(' 95   to   100 % '), {
      distanceMinPct: 95,
      distanceMaxPct: 100
    });
  });
});
