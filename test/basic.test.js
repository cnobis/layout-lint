import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateRules } from '../dist/evaluator.js';
import { parseDistanceToken, parsePercentageToken } from '../dist/dsl.js';

describe('layout-lint Core', () => {

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
      assert.strictEqual(results[0].actual, 10); // 110 - 100 = 10px
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
      assert.strictEqual(results[0].actual, 5); // 105 - 100 = 5px, less than required 20px
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
      
      assert.strictEqual(results[0].pass, true); // 1px difference within tolerance
      assert.strictEqual(results[0].actual, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple rules', () => {
      const rules = [
        { element: 'nav', relation: 'below', target: 'header', distancePx: 0 },
        { element: 'footer', relation: 'below', target: 'nav', distancePx: 50 }
      ];

      const mockResolve = (id) => {
        if (id === 'header') return { getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) };
        if (id === 'nav') return { getBoundingClientRect: () => ({ top: 100, bottom: 150, left: 0, right: 100 }) };
        if (id === 'footer') return { getBoundingClientRect: () => ({ top: 200, bottom: 250, left: 0, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[1].pass, true);
    });

    it('should handle right-of relation', () => {
      const rules = [{
        element: 'sidebar',
        relation: 'right-of',
        target: 'content',
        distancePx: 20
      }];

      const mockResolve = (id) => {
        if (id === 'content') return { getBoundingClientRect: () => ({ top: 0, bottom: 500, left: 0, right: 600 }) };
        if (id === 'sidebar') return { getBoundingClientRect: () => ({ top: 0, bottom: 500, left: 620, right: 800 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 20); // 620 - 600 = 20px
    });

    it('should pass centered-x with 1px tolerance', () => {
      const rules = [{
        element: 'cta',
        relation: 'centered-x',
        target: 'hero'
      }];

      const mockResolve = (id) => {
        if (id === 'hero') return { getBoundingClientRect: () => ({ top: 0, bottom: 300, left: 100, right: 700 }) };
        if (id === 'cta') return { getBoundingClientRect: () => ({ top: 200, bottom: 260, left: 300, right: 501 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 0.5);
    });

    it('should fail centered-x when horizontal center drifts', () => {
      const rules = [{
        element: 'cta',
        relation: 'centered-x',
        target: 'hero'
      }];

      const mockResolve = (id) => {
        if (id === 'hero') return { getBoundingClientRect: () => ({ top: 0, bottom: 300, left: 100, right: 700 }) };
        if (id === 'cta') return { getBoundingClientRect: () => ({ top: 200, bottom: 260, left: 360, right: 560 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, false);
      assert.strictEqual(results[0].actual, 60);
    });

    it('should pass equal-gap-x with tolerance', () => {
      const rules = [{
        element: 'logo1',
        relation: 'equal-gap-x',
        target: 'logo2',
        target2: 'logo3',
        distancePx: 2
      }];

      const mockResolve = (id) => {
        if (id === 'logo1') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 100, right: 180 }) };
        if (id === 'logo2') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 195, right: 285 }) };
        if (id === 'logo3') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 300, right: 390 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 0);
    });

    it('should fail equal-gap-x when gaps differ beyond tolerance', () => {
      const rules = [{
        element: 'logo1',
        relation: 'equal-gap-x',
        target: 'logo2',
        target2: 'logo3',
        distancePx: 2
      }];

      const mockResolve = (id) => {
        if (id === 'logo1') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 100, right: 180 }) };
        if (id === 'logo2') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 196, right: 286 }) };
        if (id === 'logo3') return { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 314, right: 404 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, false);
      assert.strictEqual(results[0].actual, 12);
    });

    it('should pass text is with browser-like whitespace normalization', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-is',
        textExpected: 'Welcome user@example.com to our cool website!'
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: '  Welcome   user@example.com\n to our cool   website!  ',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass text starts/ends/contains checks', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-starts',
        textExpected: 'Welcome'
      }, {
        element: 'greeting',
        relation: 'text-ends',
        textExpected: 'website!'
      }, {
        element: 'greeting',
        relation: 'text-contains',
        textExpected: 'to our cool'
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[1].pass, true);
      assert.strictEqual(results[2].pass, true);
    });

    it('should pass text matches regex', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-matches',
        textExpected: 'Welcome .* to our cool website!'
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass negated text rule when text check fails', () => {
      const rules = [{
        element: 'greeting',
        negated: true,
        relation: 'text-contains',
        textExpected: 'forbidden token'
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass text lowercase contains check', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-contains',
        textExpected: 'welcome user@example.com',
        textOperations: ['lowercase']
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome User@Example.com to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass text uppercase starts check', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-starts',
        textExpected: 'WELCOME',
        textOperations: ['uppercase']
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass text singleline is check for multiline source', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-is',
        textExpected: 'Welcome user@example.com to our cool website!',
        textOperations: ['singleline']
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com\n to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass chained text operations', () => {
      const rules = [{
        element: 'greeting',
        relation: 'text-matches',
        textExpected: 'WELCOME .* WEBSITE!',
        textOperations: ['singleline', 'uppercase']
      }];

      const mockResolve = (id) => {
        if (id === 'greeting') return {
          innerText: 'Welcome user@example.com\n to our cool website!',
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass css is check against computed style', () => {
      const rules = [{
        element: 'login-button',
        relation: 'css-is',
        cssProperty: 'font-size',
        cssExpected: '18px'
      }];

      const mockResolve = (id) => {
        if (id === 'login-button') return {
          ownerDocument: {
            defaultView: {
              getComputedStyle: () => ({
                getPropertyValue: (property) => {
                  if (property === 'font-size') return '18px';
                  return '';
                }
              })
            }
          },
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, '18px');
    });

    it('should pass css starts/ends/contains checks', () => {
      const rules = [{
        element: 'login-button',
        relation: 'css-starts',
        cssProperty: 'font-family',
        cssExpected: 'Helvetica'
      }, {
        element: 'login-button',
        relation: 'css-ends',
        cssProperty: 'font-family',
        cssExpected: 'sans-serif'
      }, {
        element: 'login-button',
        relation: 'css-contains',
        cssProperty: 'font-family',
        cssExpected: 'Arial'
      }];

      const mockResolve = (id) => {
        if (id === 'login-button') return {
          ownerDocument: {
            defaultView: {
              getComputedStyle: () => ({
                getPropertyValue: (property) => {
                  if (property === 'font-family') return 'Helvetica, Arial, sans-serif';
                  return '';
                }
              })
            }
          },
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[1].pass, true);
      assert.strictEqual(results[2].pass, true);
    });

    it('should pass css matches regex', () => {
      const rules = [{
        element: 'login-button',
        relation: 'css-matches',
        cssProperty: 'font-family',
        cssExpected: '.*Arial.*'
      }];

      const mockResolve = (id) => {
        if (id === 'login-button') return {
          ownerDocument: {
            defaultView: {
              getComputedStyle: () => ({
                getPropertyValue: (property) => {
                  if (property === 'font-family') return 'Helvetica, Arial, sans-serif';
                  return '';
                }
              })
            }
          },
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass negated css rule when css check fails', () => {
      const rules = [{
        element: 'login-button',
        negated: true,
        relation: 'css-contains',
        cssProperty: 'background-color',
        cssExpected: 'rgba(255, 0, 0'
      }];

      const mockResolve = (id) => {
        if (id === 'login-button') return {
          ownerDocument: {
            defaultView: {
              getComputedStyle: () => ({
                getPropertyValue: (property) => {
                  if (property === 'background-color') return 'rgb(24, 24, 24)';
                  return '';
                }
              })
            }
          },
          getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
    });

    it('should pass visible and absent checks', () => {
      const rules = [{
        element: 'banner',
        relation: 'visible'
      }, {
        element: 'ghost',
        relation: 'absent'
      }];

      const mockResolve = (id) => {
        if (id === 'banner') return {
          getBoundingClientRect: () => ({ top: 10, bottom: 40, left: 10, right: 140, width: 130, height: 30 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[1].pass, true);
    });

    it('should support negated visibility checks', () => {
      const rules = [{
        element: 'banner',
        negated: true,
        relation: 'visible'
      }];

      const mockResolve = (id) => {
        if (id === 'banner') return {
          getBoundingClientRect: () => ({ top: 10, bottom: 40, left: 10, right: 140, width: 130, height: 30 })
        };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, false);
    });

    it('should pass count any and count visible ranges', () => {
      const rules = [{
        element: 'global',
        relation: 'count-any',
        countPattern: 'menu_item-*',
        countMin: 3,
        countMax: 5
      }, {
        element: 'global',
        relation: 'count-visible',
        countPattern: 'menu_item-*',
        comparator: '>=',
        countExpected: 2
      }];

      const visibleItem = { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 0, right: 100, width: 100, height: 20 }) };
      const hiddenItem = { getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }) };

      const mockResolvePattern = () => [visibleItem, hiddenItem, visibleItem];

      const results = evaluateRules(rules, () => null, mockResolvePattern);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 3);
      assert.strictEqual(results[1].pass, true);
      assert.strictEqual(results[1].actual, 2);
    });

    it('should pass count absent exact check', () => {
      const rules = [{
        element: 'global',
        relation: 'count-absent',
        countPattern: 'menu_item-*',
        countExpected: 2
      }];

      const visibleItem = { getBoundingClientRect: () => ({ top: 0, bottom: 20, left: 0, right: 100, width: 100, height: 20 }) };
      const hiddenItem = { getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }) };

      const mockResolvePattern = () => [visibleItem, hiddenItem, null, hiddenItem];

      const results = evaluateRules(rules, () => null, mockResolvePattern);
      assert.strictEqual(results[0].pass, false);
      assert.strictEqual(results[0].actual, 3);
    });

    it('should pass centered relation tolerance check', () => {
      const rules = [{
        element: 'label',
        relation: 'centered-x',
        target: 'box',
        distancePx: 1
      }];

      const mockResolve = (id) => {
        if (id === 'label') return { getBoundingClientRect: () => ({ top: 30, bottom: 60, left: 51, right: 151 }) };
        if (id === 'box') return { getBoundingClientRect: () => ({ top: 0, bottom: 120, left: 0, right: 200 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 1);
    });

    it('should pass near with single direction', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['left'], distancePx: 10 }
        ]
      }];
      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true); // textfield is 10px to the left of button (gap = 50-40 = 10)
    });

    it('should pass near with multiple directions', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['bottom'], distancePx: 5 },
          { directions: ['left'], distancePx: 10 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 70, bottom: 100, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 35, bottom: 65, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true); // textfield is 5px below button (button.bottom=65, textfield.top=70, gap=5) and 10px to the left (button.left=50, textfield.right=40, gap=10)
    });

    it('should pass near with a ranged distance', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['left'], distanceMinPx: 5, distanceMaxPx: 15 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
    });

    it('should pass near range for values inside 5 to 15px', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['left'], distanceMinPx: 5, distanceMaxPx: 15 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 46, right: 96 }) }; // gap = 6
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 6);
    });

    it('should pass near range at upper bound 15px', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['left'], distanceMinPx: 5, distanceMaxPx: 15 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 55, right: 105 }) }; // gap = 15
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 15);
    });

    it('should fail near range above 15px', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['left'], distanceMinPx: 5, distanceMaxPx: 15 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 0, bottom: 30, left: 56, right: 106 }) }; // gap = 16
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, false);
    });

    it('should fail near multi-direction clause when one direction differs', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['bottom', 'left'], distancePx: 5 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 70, bottom: 100, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 35, bottom: 65, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, false);
    });

    it('should pass near with mixed clause distances (top and left)', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['top'], distancePx: 5 },
          { directions: ['left'], distancePx: 10 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 30, bottom: 60, left: 0, right: 40 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 65, bottom: 95, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, true);
    });

    it('should fail near with mixed clause distances when one axis mismatches', () => {
      const rules = [{
        element: 'textfield',
        relation: 'near',
        target: 'button',
        nearDirections: [
          { directions: ['top'], distancePx: 5 },
          { directions: ['left'], distancePx: 10 }
        ]
      }];

      const mockResolve = (id) => {
        if (id === 'textfield') return { getBoundingClientRect: () => ({ top: 30, bottom: 60, left: 5, right: 45 }) };
        if (id === 'button') return { getBoundingClientRect: () => ({ top: 65, bottom: 95, left: 50, right: 100 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);

      assert.strictEqual(results[0].pass, false);
    });
  });
});
