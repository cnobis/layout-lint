import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// Provide minimal globals so the modules can be imported without exploding.
// The widget construction path requires document; auto.js bails out when no
// `<script type="layout-lint">` is present, so the import is side-effect-safe.
before(() => {
  globalThis.document = {
    readyState: 'complete',
    documentElement: {
      hasAttribute: () => false,
      setAttribute: () => {},
      removeAttribute: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
  };
  globalThis.HTMLElement = class {};
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

after(() => {
  delete globalThis.document;
  delete globalThis.customElements;
  delete globalThis.HTMLElement;
  delete globalThis.window;
});

describe('drop-in entry points', () => {
  it('auto.js exports a bootstrap function and is safe to import with no spec scripts', async () => {
    const mod = await import('../dist/auto.js');
    assert.strictEqual(typeof mod.bootstrap, 'function');
    assert.strictEqual(mod.bootstrap(), null,
      'bootstrap with no <script type="layout-lint"> on the page should return null');
  });

  it('web-component.js exports LayoutLintElement and registers the <layout-lint> tag', async () => {
    const definedTags = [];
    globalThis.customElements = {
      get: (tag) => (definedTags.includes(tag) ? class {} : undefined),
      define: (tag) => { definedTags.push(tag); },
    };
    const mod = await import('../dist/web-component.js');
    assert.strictEqual(typeof mod.LayoutLintElement, 'function');
    assert.ok(definedTags.includes('layout-lint'),
      'expected web-component.js to register the <layout-lint> tag on import');
  });
});
