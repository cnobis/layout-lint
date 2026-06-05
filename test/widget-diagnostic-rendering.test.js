import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createSpecEditor } from '../dist/devtools/widget/spec-editor.js';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.childNodes = this.children;
    this.nodeType = 1;
    this.style = {};
    this.dataset = {};
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.parentNode = null;
    this.parentElement = null;
    this.innerHTML = '';
    this.attributes = new Map();
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    child.parentElement = this;
    return child;
  }
  contains() { return false; }
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
    for (const handler of handlers) handler(nextEvent);
    return true;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

const installFakeDom = () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    createRange: () => ({ setStart() {}, collapse() {}, selectNodeContents() {} }),
    getElementById: () => null,
    head: new FakeElement('head'),
    body: new FakeElement('body'),
  };
  const window = {
    setTimeout: (cb) => { cb(); return 1; },
    clearTimeout: () => {},
    getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} }),
  };
  global.Node = global.Node ?? { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  global.document = document;
  global.window = window;
  return () => {
    global.window = previousWindow;
    global.document = previousDocument;
  };
};

const collectText = (element) => {
  const parts = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node.textContent === 'string' && node.textContent) parts.push(node.textContent);
    if (node.children) for (const c of node.children) visit(c);
  };
  visit(element);
  return parts.join('\n');
};

const makeMonitor = (diagnostics) => ({
  controller: {
    getSpecText: () => 'nav abav header',
    setSpecText: () => {},
    evaluateNow: async () => ({ rules: [], results: [], diagnostics }),
    getLatestResult: () => ({ rules: [], results: [], diagnostics }),
  },
});

const renderArgs = {
  footerStatusMode: 'ready',
  footerStatusActionLabel: 'evaluating...',
  footerDiagnosticsSummary: { total: 1, errors: 1, warnings: 0 },
  footerPassedCount: 0,
  footerTotalCount: 1,
  editorBackground: '#f5f7fe',
  scheduleClampWidgetIntoViewport: () => {},
};

const makeEditor = (diagnostics) =>
  createSpecEditor({
    monitor: makeMonitor(diagnostics).controller,
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

describe('spec editor diagnostic rendering', () => {
  let restoreDom;
  beforeEach(() => { restoreDom = installFakeDom(); });
  afterEach(() => { restoreDom(); });

  const semanticDiag = {
    code: 'LL-SEMANTIC-ELEMENT-NOT-FOUND',
    severity: 'error',
    message: 'Element not found: nav',
    range: { startIndex: 0, endIndex: 3, start: { line: 1, column: 0 }, end: { line: 1, column: 3 } },
    primaryLabel: 'element not in DOM',
    hint: 'check the element id or the matching `define` declaration.',
  };

  it('renders the primaryLabel as a prefix on the message', () => {
    const editor = makeEditor([semanticDiag]);
    editor.open();
    const body = new FakeElement('div');
    editor.renderPanel({ ...renderArgs, body, status: new FakeElement('span') });
    const text = collectText(body);
    assert.ok(text.includes('element not in DOM:'), 'primary label should appear with a trailing colon');
    assert.ok(text.includes('Element not found: nav'), 'message text should still appear');
  });

  it('renders the hint on its own line prefixed with `hint:`', () => {
    const editor = makeEditor([semanticDiag]);
    editor.open();
    const body = new FakeElement('div');
    editor.renderPanel({ ...renderArgs, body, status: new FakeElement('span') });
    const text = collectText(body);
    assert.ok(text.includes('hint: check the element id'), 'hint row should appear');
  });

  it('omits the hint row when no hint is present', () => {
    const bare = { ...semanticDiag, hint: undefined, primaryLabel: undefined };
    const editor = makeEditor([bare]);
    editor.open();
    const body = new FakeElement('div');
    editor.renderPanel({ ...renderArgs, body, status: new FakeElement('span') });
    const text = collectText(body);
    assert.ok(!text.includes('hint:'), 'no hint row when the diagnostic carries no hint');
  });
});
