import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeWidgetSettings,
  DEFAULT_WIDGET_SETTINGS,
  MIN_WIDGET_WIDTH_PX,
  MAX_WIDGET_WIDTH_PX,
  MIN_WIDGET_HEIGHT_PX,
  MAX_WIDGET_HEIGHT_PX,
} from '../dist/devtools/settings/widget-settings.js';
import { createWidgetState } from '../dist/devtools/widget/state.js';

const makeDefaults = () => ({
  highlightsEnabled: true,
  tabsEnabled: true,
  constraintsPerPage: 10,
  minimized: false,
  statusTransitionDelayEnabled: true,
  widthPx: 420,
  heightPx: 360,
});

describe('widget settings normalization', () => {
  it('clamps width/height and constraints into supported bounds', () => {
    const normalized = normalizeWidgetSettings(
      {
        constraintsPerPage: 999,
        widthPx: MIN_WIDGET_WIDTH_PX - 100,
        heightPx: MAX_WIDGET_HEIGHT_PX + 100,
      },
      makeDefaults()
    );

    assert.strictEqual(normalized.constraintsPerPage, 200);
    assert.strictEqual(normalized.widthPx, MIN_WIDGET_WIDTH_PX);
    assert.strictEqual(normalized.heightPx, MAX_WIDGET_HEIGHT_PX);
  });

  it('keeps fallback size when provided values are invalid', () => {
    const fallback = {
      ...makeDefaults(),
      widthPx: 530,
      heightPx: 410,
    };

    const normalized = normalizeWidgetSettings(
      {
        widthPx: 'NaN',
        heightPx: '',
      },
      fallback
    );

    assert.strictEqual(normalized.widthPx, 530);
    assert.strictEqual(normalized.heightPx, 410);
  });

  it('uses default settings when no fallback is passed', () => {
    const normalized = normalizeWidgetSettings(undefined);

    assert.strictEqual(normalized.highlightsEnabled, DEFAULT_WIDGET_SETTINGS.highlightsEnabled);
    assert.strictEqual(normalized.tabsEnabled, DEFAULT_WIDGET_SETTINGS.tabsEnabled);
    assert.strictEqual(normalized.statusTransitionDelayEnabled, DEFAULT_WIDGET_SETTINGS.statusTransitionDelayEnabled);
  });
});

describe('widget state size patch behavior', () => {
  const makeState = () =>
    createWidgetState({
      initialSettings: {
        ...makeDefaults(),
        widthPx: 500,
        heightPx: 380,
      },
      defaults: makeDefaults(),
    });

  it('preserves width/height when patch omits size fields', () => {
    const state = makeState();

    state.updateSettings({ tabsEnabled: false });
    const settings = state.getSettings();

    assert.strictEqual(settings.widthPx, 500);
    assert.strictEqual(settings.heightPx, 380);
    assert.strictEqual(settings.tabsEnabled, false);
  });

  it('clears width/height when patch explicitly includes undefined values', () => {
    const state = makeState();

    state.updateSettings({ widthPx: undefined, heightPx: undefined });
    const settings = state.getSettings();

    assert.strictEqual(settings.widthPx, undefined);
    assert.strictEqual(settings.heightPx, undefined);
  });

  it('accepts finite size updates and rounds to integers', () => {
    const state = makeState();

    state.updateSettings({ widthPx: 612.6, heightPx: 411.2 });
    const settings = state.getSettings();

    assert.strictEqual(settings.widthPx, 613);
    assert.strictEqual(settings.heightPx, 411);
  });

  it('does not clamp in state update because clamping belongs to normalization layer', () => {
    const state = makeState();

    state.updateSettings({ widthPx: MAX_WIDGET_WIDTH_PX + 100, heightPx: MIN_WIDGET_HEIGHT_PX - 50 });
    const settings = state.getSettings();

    assert.strictEqual(settings.widthPx, MAX_WIDGET_WIDTH_PX + 100);
    assert.strictEqual(settings.heightPx, MIN_WIDGET_HEIGHT_PX - 50);
  });
});
