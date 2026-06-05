# layout-lint

<img width="1966" height="252" alt="logo" src="https://github.com/user-attachments/assets/cc27bec9-9574-49da-8880-8761a77bdce7" />

A DSL for testing layout constraints in the browser. Write rules like `nav below header 20px` to verify spatial relationships between elements.

## Installation

```bash
npm install layout-lint
```

## Usage

```typescript
import { createLayoutLint } from 'layout-lint';

const lint = createLayoutLint({
  specText: `
    nav below header 20px
    sidebar left-of content
  `,
  wasmUrl: './layout_lint.wasm',
});

const { results, diagnostics } = await lint.run();

if (diagnostics?.length) {
  console.error(lint.formatDiagnostics(diagnostics));
  console.error(lint.explain(diagnostics[0].code));
}
```

The factory wraps three building blocks:

- `run()` parses the spec, evaluates rules against the live DOM, and returns parse plus semantic diagnostics.
- `formatDiagnostics(list, { color, includeExplain })` renders each entry as a Rust-style frame with source caret, primary label, and hint.
- `explain(code)` returns the long-form explanation for a diagnostic code from the static catalogue.

For lower-level access the original one-shot is still exported:

```typescript
import { runLayoutLint } from 'layout-lint';

const { rules, results, diagnostics } = await runLayoutLint({
  specText,
  wasmUrl: './layout_lint.wasm',
});
```

Each diagnostic carries:

- `code`: stable identifier (for example `LL-PARSE-SYNTAX`, `LL-RULE-MALFORMED`)
- `severity`: `error` or `warning`
- `message`: short factual summary
- `range`: source indices plus line/column positions
- `snippet` (optional): source fragment near the issue
- `primaryLabel` (optional): one-word role for the highlighted span
- `secondarySpans` (optional): related ranges painted alongside the primary span
- `hint` (optional): single-line didactic nudge

## Integration Recipes

### 1. Vanilla script tag

Drop layout-lint into a static page via a CDN. Useful for prototypes and small demos.

```html
<!doctype html>
<script type="module">
  import { createLayoutLint } from 'https://esm.sh/layout-lint';

  const lint = createLayoutLint({
    specText: 'nav above main 16px',
    wasmUrl: 'https://esm.sh/layout-lint/layout_lint.wasm',
  });

  const { diagnostics, results } = await lint.run();
  document.getElementById('out').textContent =
    diagnostics.length
      ? lint.formatDiagnostics(diagnostics)
      : `${results.filter((r) => r.pass).length} of ${results.length} rules pass`;
</script>
<pre id="out"></pre>
```

### 2. Vite app

The `exports` map ships the wasm binary as a first-class entry. Vite resolves it with the `?url` suffix so no manual copy step is needed.

```typescript
import { createLayoutLint } from 'layout-lint';
import wasmUrl from 'layout-lint/wasm/layout-lint?url';

const lint = createLayoutLint({
  specText: import.meta.env.VITE_LAYOUT_SPEC,
  wasmUrl,
});

const { diagnostics } = await lint.run();
if (diagnostics.length) {
  console.error(lint.formatDiagnostics(diagnostics, { color: true }));
}
```

For the diagnostic catalogue or the formatter in isolation:

```typescript
import { explainCode } from 'layout-lint/diagnostic-codes';
import { formatDiagnostic } from 'layout-lint/diagnostics';
```

### 3. Node smoke test with jsdom

Run layout-lint headlessly in CI to assert that a static page satisfies its spec.

```typescript
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createLayoutLint } from 'layout-lint';

const dom = new JSDOM(readFileSync('./fixture.html', 'utf8'));
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const lint = createLayoutLint({
  specText: readFileSync('./layout.spec', 'utf8'),
  wasmUrl: new URL(
    './node_modules/layout-lint/layout_lint.wasm',
    import.meta.url,
  ).href,
});

const { diagnostics, results } = await lint.run();
if (diagnostics.length) {
  console.error(lint.formatDiagnostics(diagnostics));
  process.exit(1);
}
const failing = results.filter((r) => !r.pass);
if (failing.length) process.exit(1);
```

Note: jsdom does not run a real layout engine. It returns zeros for `getBoundingClientRect`, which is fine for parse and semantic checks but limits spatial assertions. For true layout verification pair the spec with a Playwright or browser-based harness.

## Devtools Widget

```typescript
import {
  createLayoutLintMonitor,
  createLayoutLintWidget,
  createConsoleReporter,
} from 'layout-lint/devtools';

const monitor = createLayoutLintMonitor({
  specText,
  wasmUrl: './layout_lint.wasm',
  reporters: [createConsoleReporter()],
});

createLayoutLintWidget(monitor, {
  initialPosition: { x: 16, y: 16 },
  tabsEnabled: true,
  constraintsPerPage: 10,
  persistSettings: true,
});
```

Widget options:

- `tabsEnabled` (default `true`): enables category tabs (`All`, `Failing`, `Passing`) plus page tabs.
- `constraintsPerPage` (default `10`): max visible constraints per page when tabs are enabled.
- `statusTransitionDelayEnabled` (default `true`): enables/disables the short status transition delay for reevaluate/spec-apply actions.
- `widthPx` (default `340`): initial expanded widget width in pixels.
- `heightPx` (default `360`): initial expanded widget height in pixels.
- `persistSettings` (default `true`): stores widget settings in localStorage.
- `settingsStorageKey` (default `layout-lint:widget-settings`): custom localStorage key.

In the widget, use the `settings` button to open the settings panel and configure tabs behavior live.
Use `Reset Size` in settings to restore default expanded width/height without resetting the rest of your widget preferences.
Use the `spec` button to edit the layout DSL directly in the widget, then apply changes with the `Apply` button or `Cmd/Ctrl+Enter`.
When applying an invalid spec, the editor stays open and displays parse diagnostics with line/column references.

## License

MIT
