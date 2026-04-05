import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createWidgetState } from '../dist/devtools/widget/state.js';

const makeRule = (index) => ({
  element: `item-${index}`,
  relation: 'below',
  target: `target-${index}`,
  pass: index % 2 === 0,
  actual: index,
});

describe('widget state pagination', () => {
  it('derives hybrid category and page slices', () => {
    const state = createWidgetState({
      initialSettings: { tabsEnabled: true, constraintsPerPage: 25 },
      defaults: { tabsEnabled: true, constraintsPerPage: 25 },
    });

    const rules = Array.from({ length: 60 }, (_, index) => makeRule(index + 1));
    state.applyResults(rules);

    let view = state.getViewModel(rules);
    assert.strictEqual(view.counts.all, 60);
    assert.strictEqual(view.totalPages, 3);
    assert.strictEqual(view.visibleResults.length, 25);

    state.setActivePage(3);
    view = state.getViewModel(rules);
    assert.strictEqual(view.page, 3);
    assert.strictEqual(view.visibleResults.length, 10);

    state.setActiveCategory('failing');
    view = state.getViewModel(rules);
    assert.strictEqual(view.totalInCategory, 30);
    assert.strictEqual(view.totalPages, 2);
    assert.strictEqual(view.visibleResults.length, 25);
  });

  it('respects settings updates and hides active rule off-page when not pinned', () => {
    const state = createWidgetState({
      initialSettings: { tabsEnabled: true, constraintsPerPage: 10 },
      defaults: { tabsEnabled: true, constraintsPerPage: 25 },
    });

    const rules = Array.from({ length: 30 }, (_, index) => makeRule(index + 1));
    state.applyResults(rules);

    state.setActiveRule(rules[0]);
    state.setActivePage(2);
    assert.strictEqual(state.getActiveRule(), null);

    state.updateSettings({ tabsEnabled: false });
    let view = state.getViewModel(rules);
    assert.strictEqual(view.totalPages, 1);
    assert.strictEqual(view.visibleResults.length, 30);

    state.updateSettings({ constraintsPerPage: 9999 });
    view = state.getViewModel(rules);
    assert.strictEqual(view.settings.constraintsPerPage, 200);
  });
});
