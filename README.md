# layout-lint

<img width="1966" height="252" alt="logo" src="https://github.com/user-attachments/assets/cc27bec9-9574-49da-8880-8761a77bdce7" />

A DSL for testing layout constraints in the browser. Write rules like `nav below header 20px` to verify spatial relationships between elements.

## Installation

```bash
npm install layout-lint
```

## Usage

```typescript
import { runLayoutLint } from 'layout-lint';

const spec = `
  // position constraints
  nav below header 20px
  sidebar left-of content
`;

const { results } = await runLayoutLint({
  specText: spec,
  wasmUrl: './layout_lint.wasm'
});
```

The runtime result also includes optional parser diagnostics:

```typescript
const { rules, results, diagnostics } = await runLayoutLint({
  specText,
  wasmUrl: './layout_lint.wasm'
});

if (diagnostics?.length) {
  diagnostics.forEach((item) => {
    console.warn(`${item.code} L${item.range.start.line}:${item.range.start.column + 1} ${item.message}`);
  });
}
```

Diagnostics include:

- `code`: stable identifier (for example `LL-PARSE-SYNTAX`, `LL-RULE-MALFORMED`)
- `severity`: `error` or `warning`
- `message`: human-readable issue summary
- `range`: source indices + line/column positions
- `snippet` (optional): source fragment near the issue

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
