# layout-lint

![layout-lint](demo/images/logo-wide.svg)

**[Try it live →](https://cnobis.github.io/layout-lint/)**

A DSL for testing layout in the browser. Rules read as short sentences about the page, and a floating widget shows pass and fail against the live DOM.

```text
define card-* as ".card";
group chrome as header, nav, footer;

main below header 24px;
card-1 same-width card-2;
@chrome visible;
count visible card-* is >= 3;
```

The live site has four interactive demos, a parse-tree explorer, and the grammar reference. Language documentation: [docs/LANGUAGE.md](docs/LANGUAGE.md).

## Install

```bash
npm install layout-lint
```

Or from a CDN without an install step:

```html
<script type="module" src="https://esm.sh/layout-lint/auto"></script>
```

## Static HTML

One script tag. On load, the module reads every `<script type="layout-lint">` block, evaluates the spec against the live DOM, and mounts the widget.

```html
<script type="layout-lint">
  header above nav 0px;
  nav above main 24px;
</script>
<script type="module" src="https://esm.sh/layout-lint/auto"></script>
```

The same is available as a custom element through `layout-lint/web-component`. The spec goes inside the `<layout-lint>` element or its `spec` attribute, and the tag type-checks in React, Preact, Solid, and Vue 3.

## Bundler apps

Import the devtools entry behind a dev-mode guard so the widget never ships to production. The widget mounts in a Shadow DOM root on `document.body`, so host page styles cannot deform it.

```typescript
// Vite shown. Elsewhere: process.env.NODE_ENV !== 'production'
if (import.meta.env.DEV) {
  const { createLayoutLintMonitor, createLayoutLintWidget } = await import('layout-lint/devtools');
  const monitor = createLayoutLintMonitor({ specText });
  createLayoutLintWidget(monitor);
}
```

The widget's spec button opens an inline editor with syntax highlighting and live diagnostics. Apply with `Cmd/Ctrl+Enter`. Size, position, pagination, and persistence are set through the options object of `createLayoutLintWidget`.

## CI and Node

```typescript
import { createLayoutLint } from 'layout-lint';

const lint = createLayoutLint({ specText });
const { results, diagnostics } = await lint.run();

if (diagnostics.length) console.error(lint.formatDiagnostics(diagnostics));
if (results.some((r) => !r.pass)) process.exit(1);
```

No `wasmUrl`, no `locateFile`. The grammar and the tree-sitter runtime are inlined into the bundle. For a synthetic DOM, pass `dom: window.document`. Note that jsdom runs no layout engine, so spatial rules need a real browser harness such as Playwright or Cypress.

## Diagnostics

Every diagnostic carries a stable `code`, a `message`, and a source `range`, plus an optional snippet, labels, and a hint. The formatter renders Rust-style frames with a source caret. Both are exported standalone:

```typescript
import { explainCode } from 'layout-lint/diagnostic-codes';
import { formatDiagnostic } from 'layout-lint/diagnostics';
```

## Demos

| Demo | What it shows |
| --- | --- |
| [tutorial](demo/tutorial/) | A guided tour of the DSL. Start here. |
| [gallery](demo/gallery/) | Containment and sizing: `inside` with offsets, wildcards, groups. |
| [bar](demo/bar/) | Text, CSS, visibility, and count rules. |
| [studio](demo/studio/) | Alignment, centering, `equal-gap`, `near`. |

```bash
npm run serve
# http://127.0.0.1:8080/demo/
```

## External WASM

The inlined WASM adds about 230 KiB to the bundle. To serve it over the network instead:

```typescript
const lint = createLayoutLint({
  specText,
  wasmUrl: '/assets/layout_lint.wasm',          // grammar
  locateFile: () => '/assets/tree-sitter.wasm', // runtime
});
```

## License

MIT
