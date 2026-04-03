import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateRules } from '../dist/core/evaluator.js';

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
    assert.strictEqual(results[0].actual, 20);
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

    assert.strictEqual(results[0].pass, true);
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

    assert.strictEqual(results[0].pass, true);
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
