import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateRules } from '../dist/core/evaluator.js';

describe('Rule Evaluation', () => {
  it('should pass when directional constraint is met', () => {
    const rules = [{
      element: 'nav',
      relation: 'below',
      target: 'header',
      distancePx: 10
    }];

    const mockResolve = (id) => {
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 110, bottom: 150, left: 0, right: 100 }) };
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 10);
  });

  it('should fail when directional constraint is not met', () => {
    const rules = [{
      element: 'nav',
      relation: 'below',
      target: 'header',
      distancePx: 20
    }];

    const mockResolve = (id) => {
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 105, bottom: 150, left: 0, right: 100 }) };
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results[0].pass, false);
    assert.strictEqual(results[0].actual, 5);
  });

  it('should pass negated directional rule when base rule fails', () => {
    const rules = [{
      element: 'nav',
      negated: true,
      relation: 'below',
      target: 'header',
      distancePx: 20
    }];

    const mockResolve = (id) => {
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 105, bottom: 150, left: 0, right: 100 }) };
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 5);
  });

  it('should pass directional constraint within a range', () => {
    const rules = [{
      element: 'nav',
      relation: 'below',
      target: 'header',
      distanceMinPx: 5,
      distanceMaxPx: 15
    }];

    const mockResolve = (id) => {
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 110, bottom: 150, left: 0, right: 100 }) };
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 10);
  });

  it('should fail directional constraint outside a range', () => {
    const rules = [{
      element: 'nav',
      relation: 'below',
      target: 'header',
      distanceMinPx: 5,
      distanceMaxPx: 15
    }];

    const mockResolve = (id) => {
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 130, bottom: 170, left: 0, right: 100 }) };
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, false);
    assert.strictEqual(results[0].actual, 30);
  });

  it('should pass inside when element is fully contained', () => {
    const rules = [{
      element: 'badge',
      relation: 'inside',
      target: 'gallery'
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: 50, bottom: 100, left: 50, right: 100 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 0);
  });

  it('should fail inside when element is not fully contained', () => {
    const rules = [{
      element: 'badge',
      relation: 'inside',
      target: 'gallery'
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: -10, bottom: 40, left: 50, right: 100 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results[0].pass, false);
    assert.strictEqual(results[0].actual, 1000);
  });

  it('should pass negated inside when element is outside', () => {
    const rules = [{
      element: 'badge',
      negated: true,
      relation: 'inside',
      target: 'gallery'
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: -10, bottom: 40, left: 50, right: 100 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
  });

  it('should pass partially-inside when elements intersect', () => {
    const rules = [{
      element: 'badge',
      relation: 'partially-inside',
      target: 'gallery'
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: -10, bottom: 40, left: 50, right: 100 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 0);
  });

  it('should pass negated partially-inside when elements do not intersect', () => {
    const rules = [{
      element: 'badge',
      negated: true,
      relation: 'partially-inside',
      target: 'gallery'
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: 250, bottom: 300, left: 250, right: 300 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
  });

  it('should pass inside with optional side offsets', () => {
    const rules = [{
      element: 'badge',
      relation: 'inside',
      target: 'gallery',
      insideOffsets: [
        { sides: ['top', 'left'], offsetPx: 10 },
        { sides: ['right'], offsetPx: 20 }
      ]
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: 10, bottom: 80, left: 10, right: 180 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
  });

  it('should pass partially-inside with negative offset', () => {
    const rules = [{
      element: 'badge',
      relation: 'partially-inside',
      target: 'gallery',
      insideOffsets: [
        { sides: ['top'], offsetPx: -10 },
        { sides: ['left'], offsetPx: 10 }
      ]
    }];

    const mockResolve = (id) => {
      if (id === 'badge') return { getBoundingClientRect: () => ({ top: -10, bottom: 40, left: 10, right: 60 }) };
      if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
  });

  it('should fail when element is not found', () => {
    const rules = [{
      element: 'missing',
      relation: 'below',
      target: 'header',
      distancePx: 10
    }];

    const mockResolve = (id) => {
      if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results[0].pass, false);
    assert.strictEqual(results[0].actual, null);
    assert.ok(results[0].reason?.includes('Element not found'));
  });

  it('should pass absolute width equality', () => {
    const rules = [{
      element: 'button',
      relation: 'width',
      distancePx: 100
    }];

    const mockResolve = (id) => {
      if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 25, left: 10, right: 110 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 100);
  });

  it('should pass width comparator rule', () => {
    const rules = [{
      element: 'button',
      relation: 'width',
      comparator: '<',
      distancePx: 101
    }];

    const mockResolve = (id) => {
      if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 25, left: 10, right: 110 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 100);
  });

  it('should pass relative percentage width equality', () => {
    const rules = [{
      element: 'comments',
      relation: 'width',
      target: 'main',
      targetProperty: 'width',
      distancePct: 100
    }];

    const mockResolve = (id) => {
      if (id === 'comments') return { getBoundingClientRect: () => ({ top: 100, bottom: 300, left: 0, right: 400 }) };
      if (id === 'main') return { getBoundingClientRect: () => ({ top: 0, bottom: 400, left: 0, right: 400 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 100);
  });

  it('should pass relative percentage width range', () => {
    const rules = [{
      element: 'comments',
      relation: 'width',
      target: 'main',
      targetProperty: 'width',
      distanceMinPct: 95,
      distanceMaxPct: 100
    }];

    const mockResolve = (id) => {
      if (id === 'comments') return { getBoundingClientRect: () => ({ top: 100, bottom: 300, left: 0, right: 390 }) };
      if (id === 'main') return { getBoundingClientRect: () => ({ top: 0, bottom: 400, left: 0, right: 400 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, true);
    assert.ok(results[0].actual >= 95 && results[0].actual <= 100);
  });

  it('should fail relative percentage width range when too small', () => {
    const rules = [{
      element: 'comments',
      relation: 'width',
      target: 'main',
      targetProperty: 'width',
      distanceMinPct: 95,
      distanceMaxPct: 100
    }];

    const mockResolve = (id) => {
      if (id === 'comments') return { getBoundingClientRect: () => ({ top: 100, bottom: 300, left: 0, right: 360 }) };
      if (id === 'main') return { getBoundingClientRect: () => ({ top: 0, bottom: 400, left: 0, right: 400 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);

    assert.strictEqual(results[0].pass, false);
    assert.ok(results[0].actual < 95);
  });

  it('should pass alignment with 1px tolerance', () => {
    const rules = [{
      element: 'logo',
      relation: 'aligned-left',
      target: 'nav'
    }];

    const mockResolve = (id) => {
      if (id === 'logo') return { getBoundingClientRect: () => ({ top: 0, bottom: 50, left: 10, right: 60 }) };
      if (id === 'nav') return { getBoundingClientRect: () => ({ top: 0, bottom: 50, left: 11, right: 200 }) };
      return null;
    };

    const results = evaluateRules(rules, mockResolve);
    
    assert.strictEqual(results[0].pass, true);
    assert.strictEqual(results[0].actual, 1);
  });
});
