# layout-lint

![layout-lint](demo/images/logo-wide.svg)

A DSL for testing layout constraints in the browser. Write rules like `nav below header 20px` to verify spatial relationships between elements. A floating widget shows pass/fail in real time.

**[Try it live](https://cnobis.github.io/layout-lint/)** — interactive demos, a live tree-sitter parse-tree explorer, and the full grammar reference.

Full language reference: [docs/LANGUAGE.md](docs/LANGUAGE.md).

<!-- TODO: drop a screenshot/GIF of the widget against the gallery demo here.
     Recommended size: ~1200x700, PNG or animated GIF. -->

## Which entry should I use?

| Goal | Entry | Setup |
| --- | --- | --- |
| Drop into static HTML | `layout-lint/auto` or `layout-lint/web-component` | One `<script type="module">` |
| Add to a Vite / Next.js / Astro app | `layout-lint/devtools` | `import` + dev-mode guard |
| Run in CI / Node | `layout-lint` | `import { createLayoutLint }` |
| Custom UI on top of the runtime | `layout-lint/devtools` | `createLayoutLintMonitor` + your own UI |

## Install

```bash
npm install layout-lint
```

Or load directly from a CDN — no install:

```html
<script type="module" src="https://esm.sh/layout-lint/auto"></script>
```

## Drop into static HTML

### `layout-lint/auto` — one script tag

```html
<script type="layout-lint">
  header above nav 0px
  nav above main 24px
</script>
<script type="module" src="https://esm.sh/layout-lint/auto"></script>
```

On `DOMContentLoaded` the module finds every `<script type="layout-lint">` block, parses the concatenated text as the spec, evaluates it against the live DOM, and mounts the floating widget. The controller is at `window.layoutLintAuto = { monitor, widget, destroy() }`. Add `data-no-widget` to the spec script for reporter-only use.

### `layout-lint/web-component` — `<layout-lint>` element

```html
<layout-lint>
  header above nav 0px
  nav above main 24px
</layout-lint>
<script type="module" src="https://esm.sh/layout-lint/web-component"></script>
```

The element creates a monitor on `connectedCallback` and tears it down on `disconnectedCallback`. The spec can also come from a `spec` attribute, and changing the attribute swaps the spec live. Add `no-widget` to suppress the widget, `visible` to keep the element in flow.

JSX / Vue templates: the package augments `JSX.IntrinsicElements` and `HTMLElementTagNameMap` so `<layout-lint spec="...">` type-checks in React, Preact, Solid, and Vue 3.

## Add to a bundler-based app

The widget mounts on `document.body` inside a Shadow DOM root, so host page styles can't deform it. Guard the import so it doesn't ship to production.

**Vite:**

```typescript
if (import.meta.env.DEV) {
  const { createLayoutLintMonitor, createLayoutLintWidget } = await import('layout-lint/devtools');
  const monitor = createLayoutLintMonitor({ specText });
  createLayoutLintWidget(monitor);
}
```

**Next.js:**

```typescript
if (process.env.NODE_ENV !== 'production') {
  const { createLayoutLintMonitor, createLayoutLintWidget } = await import('layout-lint/devtools');
  const monitor = createLayoutLintMonitor({ specText });
  createLayoutLintWidget(monitor);
}
```

**Astro:** same as Vite; wrap in `if (import.meta.env.DEV)`.

Widget options:

| Option | Default | Effect |
| --- | --- | --- |
| `tabsEnabled` | `true` | Category tabs (`All`, `Failing`, `Passing`) plus pagination |
| `constraintsPerPage` | `10` | Max constraints per page |
| `widthPx` / `heightPx` | `340` / `360` | Initial expanded size |
| `initialPosition` | `{ x: 16, y: 16 }` | Top-left offset of the widget |
| `persistSettings` | `true` | Stores widget state in `localStorage` |
| `settingsStorageKey` | `layout-lint:widget-settings` | Custom localStorage key |
| `statusTransitionDelayEnabled` | `true` | Short re-evaluate animation |

The `spec` button in the widget opens an inline editor with syntax highlighting and live diagnostics. Apply with `Cmd/Ctrl+Enter`.

## Run in CI / Node

```typescript
import { createLayoutLint } from 'layout-lint';

const lint = createLayoutLint({ specText });
const { results, diagnostics } = await lint.run();

if (diagnostics.length) console.error(lint.formatDiagnostics(diagnostics));
if (results.some((r) => !r.pass)) process.exit(1);
```

No `wasmUrl`, no `locateFile`. The grammar and the tree-sitter runtime are base64-inlined into the bundle.

Spec syntax is documented in [docs/LANGUAGE.md](docs/LANGUAGE.md).

`createLayoutLint` returns:

- `run()` — parses, evaluates against `document`, returns rules, results, diagnostics.
- `formatDiagnostics(list, { color, includeExplain })` — Rust-style frames with source caret.
- `explain(code)` — long-form explanation for a diagnostic code.
- `getSpecText()` / `setSpecText(text)` — manage the spec on the controller.

For synthetic DOM (jsdom, happy-dom), pass `dom`:

```typescript
import { JSDOM } from 'jsdom'; // npm install jsdom
import { createLayoutLint } from 'layout-lint';

const { window } = new JSDOM(fixtureHtml);
const lint = createLayoutLint({ specText, dom: window.document });
const { results, diagnostics } = await lint.run();
```

jsdom does not run a layout engine — `getBoundingClientRect()` returns zeros, so spatial assertions are limited. Use a real-browser harness (Playwright, Cypress) for full spatial verification.

## Diagnostics

Every diagnostic carries `code`, `severity` (`error` | `warning`), `message`, `range` (indices + line/column), and optional `snippet`, `primaryLabel`, `secondarySpans`, `hint`.

The catalogue and formatter are exported standalone:

```typescript
import { explainCode } from 'layout-lint/diagnostic-codes';
import { formatDiagnostic } from 'layout-lint/diagnostics';
```

## Demos

| Demo | Mode | What it shows |
| --- | --- | --- |
| [demo/tutorial](demo/tutorial/) | programmatic | 8-step guided tour of the DSL. The broken layout snaps into place as you apply each rule. **Start here.** |
| [demo/gallery](demo/gallery/) | drop-in | Containment and sizing across three rooms: `inside` with offsets, `partially inside`, percent-of widths, wildcards, groups. Drag the badge to break rules live. |
| [demo/bar](demo/bar/) | drop-in | Text, CSS, visibility and count on an izakaya menu: `text starts/ends/matches`, `css ... contains`, `visible`/`absent`, `count`. Switch the language or filter the board to perturb the rules. |
| [demo/studio](demo/studio/) | drop-in | Alignment and proximity on a web mixing desk: `aligned`, `centered`, `equal-gap`, `near`, percent-of. Ride a fader, drag a channel, or scrub the playhead. |

Run them locally:

```bash
npm run serve
# open http://127.0.0.1:8080/demo/
```

## Advanced: external WASM

The inlined WASM adds about 230 KiB to the bundle. To load it over the network instead, pass `wasmUrl` and `locateFile`:

```typescript
const lint = createLayoutLint({
  specText,
  wasmUrl: '/assets/layout_lint.wasm',
  locateFile: () => '/assets/tree-sitter.wasm',
});
```

The grammar ships as a first-class asset export:

```typescript
import wasmUrl from 'layout-lint/wasm/layout-lint?url';
const lint = createLayoutLint({ specText, wasmUrl });
```

The tree-sitter runtime WASM lives in `node_modules/web-tree-sitter/tree-sitter.wasm`.

## License

MIT
