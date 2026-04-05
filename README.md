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
  nav below header 20px
  sidebar left-of content
`;

const { results } = await runLayoutLint({
  specText: spec,
  wasmUrl: './layout_lint.wasm'
});
```

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
- `persistSettings` (default `true`): stores widget settings in localStorage.
- `settingsStorageKey` (default `layout-lint:widget-settings`): custom localStorage key.

In the widget, use the `settings` button to open the settings panel and configure tabs behavior live.
Use the `spec` button to edit the layout DSL directly in the widget, then apply changes with the `Apply` button or `Cmd/Ctrl+Enter`.

## License

MIT
