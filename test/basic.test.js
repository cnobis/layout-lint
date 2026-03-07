import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateRules } from '../dist/evaluator.js';

describe('LayoutLint Core', () => {
  
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

    it('should pass overlap when elements intersect', () => {
      const rules = [{
        element: 'badge',
        relation: 'overlaps',
        target: 'gallery'
      }];

      const mockResolve = (id) => {
        if (id === 'badge') return { getBoundingClientRect: () => ({ top: 50, bottom: 100, left: 50, right: 100 }) };
        if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      
      assert.strictEqual(results[0].pass, true);
      assert.strictEqual(results[0].actual, 0); // overlap detected
    });

    it('should fail overlap when elements do not intersect', () => {
      const rules = [{
        element: 'badge',
        relation: 'overlaps',
        target: 'gallery'
      }];

      const mockResolve = (id) => {
        if (id === 'badge') return { getBoundingClientRect: () => ({ top: 300, bottom: 400, left: 50, right: 100 }) };
        if (id === 'gallery') return { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 200 }) };
        return null;
      };

      const results = evaluateRules(rules, mockResolve);
      
      assert.strictEqual(results[0].pass, false);
      assert.strictEqual(results[0].actual, 1000); // no overlap
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

    it('should pass alignment with 1px tolerance', () => {
      const rules = [{
        element: 'logo',
        relation: 'aligned_left',
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

    it('should handle right_of relation', () => {
      const rules = [{
        element: 'sidebar',
        relation: 'right_of',
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
  });
});
