import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createSpecEditor } from '../dist/devtools/widget/spec-editor.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.parentNode = null;
    this.parentElement = null;
    this.innerHTML = '';
    this.attributes = new Map();
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
      child.parentElement = null;
    }
    return child;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) ?? [];
    const nextEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      ...event,
      target: event.target ?? this,
    };
    for (const handler of handlers) {
      handler(nextEvent);
    }
    return true;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON() {
        return this;
      },
    };
  }
}

const findFirstDescendant = (root, predicate) => {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const match = findFirstDescendant(child, predicate);
    if (match) return match;
  }
  return null;
};

const installFakeDom = () => {
  const previousWindow = global.window;
  const previousDocument = global.document;

  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    body: new FakeElement('body'),
  };

  const window = {
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout: () => {},
  };

  global.document = document;
  global.window = window;

  return () => {
    global.window = previousWindow;
    global.document = previousDocument;
  };
};

const makeMonitor = (initialSpec, diagnostics = []) => {
  let specText = initialSpec;
  const setSpecTextCalls = [];
  let evaluateCall = 0;

  return {
    controller: {
      getSpecText: () => specText,
      setSpecText: (nextSpec) => {
        setSpecTextCalls.push(nextSpec);
        specText = nextSpec;
      },
      evaluateNow: async () => {
        evaluateCall += 1;
        return {
          rules: [],
          results: [],
          diagnostics: evaluateCall === 1 ? diagnostics : [],
        };
      },
    },
    getSpecText: () => specText,
    setSpecTextCalls,
  };
};

describe('spec editor apply flow', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('renders the footer bar in spec mode and closes only after a clean apply', async () => {
    const monitor = makeMonitor('nav below header 10px');
    const actionLabels = [];
    const modes = [];
    let flashDoneCalls = 0;

    const editor = createSpecEditor({
      monitor: monitor.controller,
      isStatusTransitionDelayEnabled: () => false,
      fakeLoadingDurationMs: 0,
      specUpdateStatusLabel: 'parsing spec...',
      clearFooterStatusResetTimer: () => {},
      setFooterStatusActionLabel: (label) => actionLabels.push(label),
      setFooterStatusMode: (mode) => modes.push(mode),
      flashFooterStatusDone: () => {
        flashDoneCalls += 1;
      },
      showFooterErrorAndReset: () => {},
      requestRerender: () => {},
      updateHeaderToggleStyles: () => {},
    });

    editor.open();

    const body = new FakeElement('div');
    const status = new FakeElement('span');
    editor.renderPanel({
      body,
      status,
      footerStatusMode: 'ready',
      footerStatusActionLabel: 'evaluating...',
      footerDiagnosticsSummary: { total: 0, errors: 0, warnings: 0 },
      footerPassedCount: 1,
      footerTotalCount: 1,
      scheduleClampWidgetIntoViewport: () => {},
    });

    assert.strictEqual(body.children.length, 2);
    assert.strictEqual(body.children[1].children[0], status);

    const section = body.children[0];
    const textArea = findFirstDescendant(section, (node) => node.tagName === 'textarea');
    textArea.value = 'nav above header 10px';
    textArea.dispatchEvent({ type: 'input' });

    await editor.apply();

    assert.strictEqual(editor.isOpen(), false);
    assert.deepStrictEqual(monitor.setSpecTextCalls, ['nav above header 10px']);
    assert.ok(actionLabels.includes('parsing spec...'));
    assert.ok(modes.includes('loading'));
    assert.strictEqual(flashDoneCalls, 1);
  });

  it('keeps the spec editor open when diagnostics are returned', async () => {
    const monitor = makeMonitor('nav below header 10px', [
      {
        code: 'LL-PARSE-SYNTAX',
        severity: 'error',
        message: 'Invalid spec syntax near this segment.',
        range: {
          startIndex: 0,
          endIndex: 3,
          start: { line: 1, column: 0 },
          end: { line: 1, column: 3 },
        },
      },
    ]);
    const actionLabels = [];
    const modes = [];
    let errorResetCalls = 0;

    const editor = createSpecEditor({
      monitor: monitor.controller,
      isStatusTransitionDelayEnabled: () => false,
      fakeLoadingDurationMs: 0,
      specUpdateStatusLabel: 'parsing spec...',
      clearFooterStatusResetTimer: () => {},
      setFooterStatusActionLabel: (label) => actionLabels.push(label),
      setFooterStatusMode: (mode) => modes.push(mode),
      flashFooterStatusDone: () => {},
      showFooterErrorAndReset: () => {
        errorResetCalls += 1;
      },
      requestRerender: () => {},
      updateHeaderToggleStyles: () => {},
    });

    editor.open();

    const body = new FakeElement('div');
    const status = new FakeElement('span');
    editor.renderPanel({
      body,
      status,
      footerStatusMode: 'ready',
      footerStatusActionLabel: 'evaluating...',
      footerDiagnosticsSummary: { total: 0, errors: 0, warnings: 0 },
      footerPassedCount: 1,
      footerTotalCount: 1,
      scheduleClampWidgetIntoViewport: () => {},
    });

    const section = body.children[0];
    const textArea = findFirstDescendant(section, (node) => node.tagName === 'textarea');
    textArea.value = 'nav abave header 10px';
    textArea.dispatchEvent({ type: 'input' });

    await editor.apply();

    assert.strictEqual(editor.isOpen(), true);
    assert.strictEqual(errorResetCalls, 1);
    assert.ok(actionLabels.includes('parsing spec...'));
    assert.ok(modes.includes('loading'));
    assert.deepStrictEqual(monitor.setSpecTextCalls, ['nav abave header 10px', 'nav below header 10px']);
    assert.strictEqual(monitor.getSpecText(), 'nav below header 10px');
  });

  it('renders a syntax mirror with token classification', async () => {
    const monitor = makeMonitor('nav below header 10px');

    const editor = createSpecEditor({
      monitor: monitor.controller,
      isStatusTransitionDelayEnabled: () => false,
      fakeLoadingDurationMs: 0,
      specUpdateStatusLabel: 'parsing spec...',
      clearFooterStatusResetTimer: () => {},
      setFooterStatusActionLabel: () => {},
      setFooterStatusMode: () => {},
      flashFooterStatusDone: () => {},
      showFooterErrorAndReset: () => {},
      requestRerender: () => {},
      updateHeaderToggleStyles: () => {},
    });

    editor.open();

    const body = new FakeElement('div');
    const status = new FakeElement('span');
    editor.renderPanel({
      body,
      status,
      footerStatusMode: 'ready',
      footerStatusActionLabel: 'evaluating...',
      footerDiagnosticsSummary: { total: 0, errors: 0, warnings: 0 },
      footerPassedCount: 1,
      footerTotalCount: 1,
      scheduleClampWidgetIntoViewport: () => {},
    });

    const section = body.children[0];
    const syntaxLayer = findFirstDescendant(section, (node) => node.dataset?.layoutLintSyntaxLayer === 'true');
    assert.ok(syntaxLayer);

    const syntaxMirror = findFirstDescendant(syntaxLayer, (node) => node.tagName === 'pre');
    assert.ok(syntaxMirror);

    const syntaxTokens = [];
    for (const child of syntaxMirror.children) {
      syntaxTokens.push({ text: child.textContent, kind: child.dataset.layoutLintSyntaxKind });
    }

    assert.ok(syntaxTokens.some((token) => token.text === 'below' && token.kind === 'keyword'));
    assert.ok(syntaxTokens.some((token) => token.text === 'nav' && token.kind === 'identifier'));
    assert.ok(syntaxTokens.some((token) => token.text === '10px' && token.kind === 'number'));
  });
});