# layout-lint Architecture (MVP Snapshot)

This document describes the **current implemented architecture** of `layout-lint` as of the MVP stage.

## 1. System Overview

`layout-lint` combines two layers:

1. **Tree-sitter grammar layer**
   - Defines a small DSL for layout constraints.
   - Produces parser artifacts (`parser.c`, WASM grammar, node types).

2. **JavaScript runtime layer (browser-first MVP)**
   - Parses DSL text using Web Tree-sitter + `layout_lint.wasm`.
   - Extracts structured rules from the syntax tree.
   - Evaluates rules against live DOM geometry.
   - Returns per-rule pass/fail results.

The demo page then renders those results.

---

## 2. DSL and Grammar Layer

### 2.1 Source Grammar
- Primary grammar definition: `grammar.js`
- Grammar name: `layout_lint`
- Entry rule: `source_file` → repeated `rule`

### 2.2 Rule Shape
A rule is parsed as:
- `element` (identifier)
- `relation` (one of `below`, `above`, `left-of`, `right-of`)
- `target` (identifier)
- `distance` (`\d+px`)

Example:
```
login below header 20px
```

### 2.3 Generated/Compiled Grammar Artifacts
- JSON grammar: `src/grammar.json`
- Node types: `src/node-types.json`
- C parser: `src/parser.c`
- WASM parser binary used in demo/runtime: `layout_lint.wasm`

---

## 3. JavaScript Runtime Layer (TypeScript Source)

### 3.1 Public Runtime Entry
- `src/index.ts`
- Exposes `runLayoutLint(options)`

Input contract:
- `specText`: DSL text
- `wasmUrl`: URL/path to grammar WASM (`layout_lint.wasm`)
- optional `resolve(id)` function (defaults to DOM `getElementById`)
- optional `locateFile(path)` for Tree-sitter runtime WASM location

Output contract:
- `rules`: extracted normalized rules
- `results`: evaluated rule results (`pass`, `actual`, optional `reason`)

### 3.2 Parser Initialization
- `src/parser.ts`
- Uses `demo/web-tree-sitter.js` (`Parser`, `Language`)
- Initializes once via cached promise (`_parserPromise`)
- Loads grammar language from `wasmUrl`

### 3.3 AST-to-Rule Extraction
- `src/dsl.ts`
- Traverses tree-sitter nodes using named fields:
  - `element`, `relation`, `target`, `distance`
- Converts `distance` token (`20px`) to numeric `distancePx`

### 3.4 Rule Evaluation
- `src/evaluator.ts`
- Resolves DOM elements (default by id)
- Measures relation distance via `getBoundingClientRect()`
- Relation math:
  - `below`: `A.top - B.bottom`
  - `above`: `B.top - A.bottom`
  - `right-of`: `A.left - B.right`
  - `left-of`: `B.left - A.right`
- Pass condition: `actual >= distancePx`
- Missing elements produce `pass: false` with reason text

### 3.5 Build Output
TypeScript compiles to:
- `dist/index.js`, `dist/parser.js`, `dist/dsl.js`, `dist/evaluator.js`
- plus corresponding `.d.ts`

Build command:
- `npm run build:ts`

---

## 4. Optional Developer Tools Layer (Devtools)

An optional professional developer experience layer is available via a separate entrypoint (`layout-lint/devtools`). This layer builds on top of the core `runLayoutLint()` API and provides live monitoring and interactive UI.

### 4.1 Console Reporter
- **Module**: `src/devtools.ts` → `createConsoleReporter()`
- **Purpose**: Opt-in grouped console logging of pass/fail results
- **Usage**:
  ```typescript
  const reporter = createConsoleReporter();
  reporter(results);  // Logs grouped summary to console
  ```

### 4.2 layout-lint Monitor
- **Module**: `src/devtools.ts` → `createLayoutLintMonitor()`
- **Purpose**: Live auto-re-evaluation on DOM changes
- **Features**:
  - `ResizeObserver` for viewport/element size changes
  - `MutationObserver` for DOM structure changes
  - Debounce queue to prevent excessive evaluations (80ms default)
  - Subscriber pattern for real-time result updates
- **Usage**:
  ```typescript
  const monitor = createLayoutLintMonitor({
    specText: spec,
    wasmUrl: './layout_lint.wasm',
    reporters: [createConsoleReporter()],
    observeResize: true,
    observeMutations: true,
    debounceMs: 80
  });
  
  monitor.subscribe((results) => {
    // called whenever layout changes
  });
  ```

### 4.3 layout-lint Widget
- **Module**: `src/devtools.ts` → `createLayoutLintWidget()`
- **Purpose**: Draggable floating panel for real-time constraint visualization
- **Features**:
  - Pointer-event based dragging (no external dependencies)
  - Fixed positioning that follows user
  - Pass/fail color coding (#ecfdf5 for pass, #fef2f2 for fail)
  - Real-time updates via monitor subscription
  - Hover overlay preview (source/target labels + connector measurements)
  - Multi-pin via row click and `esc` clear-all
  - Viewport-safe, collision-aware overlay labels
  - Inline styles for quick deployment
- **Usage**:
  ```typescript
  const widget = createLayoutLintWidget(monitor, {
    title: 'layout-lint Live',
    initialPosition: { x: 24, y: 24 }
  });

  // widget auto-mounts to document.body.
  // controller methods:
  widget.setVisible(true);
  // widget.destroy();
  ```

### 4.4 Devtools Export Entry
- **Package Export**: `"./devtools"` in `package.json`
- **Resolves to**: `dist/devtools.js` + `dist/devtools.d.ts`
- **Installation**:
  ```bash
  npm install layout-lint
  ```
- **Usage**:
  ```typescript
  import { createLayoutLintMonitor, createLayoutLintWidget, createConsoleReporter } from 'layout-lint/devtools';
  ```

---

## 5. Demo Application Flow

### 5.1 Demo Entry
- `demo/index.html`

### 5.2 Runtime Sequence (in browser)
1. Read DSL from hidden `<pre id="spec">` block.
2. Call `runLayoutLint({ specText, wasmUrl, locateFile })`.
3. Parse and evaluate rules.
4. Push results to reporters and the devtools widget.
5. Render interactive overlays from widget hover/pin state.

### 5.3 Runtime Dependencies for Demo
- Built JS runtime from `dist/`
- `layout_lint.wasm` (grammar)
- `demo/web-tree-sitter.js`
- `tree-sitter.wasm` (located via `locateFile`)

Local serving command:
- `npm run serve`

---

## 6. Binding/Packaging Surface Present in Repository

The repository already contains multi-language binding scaffolding:
- Node: `bindings/node/*`, `binding.gyp`
- Go: `bindings/go/*`, `go.mod`
- Python: `bindings/python/*`, `pyproject.toml`, `setup.py`
- Rust: `bindings/rust/*`, `Cargo.toml`
- Swift: `bindings/swift/*`, `Package.swift`
- C/CMake/Make: `bindings/c/*`, `CMakeLists.txt`, `Makefile`

For the MVP, the **active functional path** is browser runtime + demo. Packaging hardening is a separate phase.

---

## 7. Current Strengths

- Grammar and runtime are cleanly separated.
- Rule extraction uses tree-sitter field names (stable and explicit).
- Evaluation logic is simple and deterministic.
- Demo proves end-to-end viability on real DOM elements.
- TypeScript sources are modular (`parser`, `dsl`, `evaluator`, `index`).

---

## 8. Known Technical Notes (MVP Context)

- Node test file currently reflects module-format mismatch under ESM package config.
- Some manifests reference `queries/*`, while no `queries/` directory is currently present.
- These do not block browser-first MVP execution, but matter for distribution hardening.

---

## 9. Recommended Next Documentation (Optional)

If needed later, add:
- `SEMANTICS.md` for formal rule math and edge cases.
- `DECISIONS.md` for ADR-style architecture choices.
- `RELEASE_PLAN.md` for post-MVP packaging and compatibility steps.
