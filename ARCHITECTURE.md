# layout-lint Architecture

This document describes the **current implemented architecture** of `layout-lint`.

## 1. System Overview

`layout-lint` combines two layers:

1. **Tree-sitter grammar layer**
   - Defines a DSL for layout constraints (spatial, containment, count, visual, text/CSS, alignment).
   - Supports element aliases (`define...as`), wildcard definitions, and groups.
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
- Entry rule: `source_file` → repeated statements (definitions, group definitions, or rules) terminated by `;`
- Comments: `# line comment`

### 2.2 Definitions and Groups

Element aliasing binds a human-readable name to a CSS selector:

```
define header as ".site-header";   # exact alias
define card-* as ".card";          # wildcard (card-1, card-2, …)
```

Groups expand a single rule into multiple rules:

```
group skeleton as header, nav, footer;
@skeleton inside screen;              # expands to 3 rules
```

### 2.3 Rule Categories

Rules are split into five hidden sub-rules in the grammar:

| Category | Examples |
|----------|----------|
| **Spatial** | `el below target 20px`, `el inside target`, `el partially inside target`, `el near target 10px left`, `el equal-gap-x a b` |
| **Count** | `count visible .card is 3`, `count any .item is >= 1`, `count absent .old is 1 to 3` |
| **Visual** | `el visible`, `el absent`, `el width 200px`, `el height >= 50% of parent/height` |
| **Text & CSS** | `el text contains "hello"`, `el css color is "red"` |
| **Alignment** | `el aligned horizontally top target`, `el centered vertically inside container` |

All non-count rules start with an element (identifier or `@group` reference) and an optional `not` negation.

### 2.4 Distances and Ranges
- Exact: `20px`
- Range: `10 to 30px`
- Signed (inside clauses): `-5px`
- Percentage: `50%`, `80 to 100%`
- Comparator prefix: `>= 20px`, `< 50%`

### 2.5 Terminal Keywords
- Relations: `below`, `above`, `left-of`, `right-of`, `aligned-top`, `aligned-bottom`, `aligned-left`, `aligned-right`, `wider-than`, `taller-than`, `same-width`, `same-height`, `distance-from-top`
- Ternary: `equal-gap-x`, `equal-gap-y` (also supports chain syntax `[a b c]`)
- Directions: `left`, `right`, `top`, `bottom`
- Visibility: `visible`, `absent`
- Match modes: `is`, `contains`, `starts`, `ends`, `matches`
- Text transforms: `lowercase`, `uppercase`, `singleline`

### 2.6 Generated/Compiled Grammar Artifacts
- JSON grammar: `src/grammar.json`
- Node types: `src/node-types.json`
- C parser: `src/parser.c`
- WASM parser binary used in demo/runtime: `layout_lint.wasm`

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
- optional `resolve(id)` function (defaults to definition-aware resolver chain)
- optional `locateFile(path)` for Tree-sitter runtime WASM location

Output contract:
- `rules`: extracted normalized rules
- `results`: evaluated rule results (`pass`, `actual`, optional `reason`)
- `diagnostics`: syntax/semantic issues from parsing
- `definitions`: resolved definition map

### 3.2 Parser Initialization
- `src/core/parser.ts`
- Uses `demo/web-tree-sitter.js` (`Parser`, `Language`)
- Initializes once via cached promise (`_parserPromise`)
- Loads grammar language from `wasmUrl`

### 3.3 AST-to-Rule Extraction
- `src/core/dsl.ts`
- Traverses tree-sitter nodes by type: `definition`, `group_definition`, `rule`
- Returns `ExtractRulesResult`:
  - `rules`: normalized `Rule[]`
  - `definitions`: `Map<string, string>` (name → CSS selector)
  - `groups`: `Map<string, string[]>` (name → member list)
  - `diagnostics`: syntax + semantic issues
- Post-expansion pass: `@group` rules are cloned for each group member
- Emits structured diagnostics for:
  - syntax-level (parser `ERROR`/missing segments)
  - extraction-level (missing element/relation in a rule)
  - semantic-level (undefined references, unused definitions)

### 3.4 Element Resolution
- `src/core/runtime.ts`
- Three-step resolver chain:
  1. Exact definition match → `querySelector(selector)`
  2. Wildcard match (e.g. `card-2` matches `card-*`) → `querySelectorAll` + 1-based index
  3. Fallback → `getElementById(name)`
- Resolved elements are cached per evaluation pass

### 3.5 Rule Evaluation
- `src/core/evaluator.ts` + `evaluator-helpers.ts`
- Handles all rule categories: spatial, containment, count, visibility, size, text, CSS, alignment
- Relation math via `getBoundingClientRect()`:
  - Positional: `below`, `above`, `left-of`, `right-of`, `distance-from-top`
  - Containment: `inside`, `partially inside` (bidirectional bbox intersection)
  - Proximity: `near` (multi-direction distance clauses)
  - Comparison: `wider-than`, `taller-than`, `same-width`, `same-height`
  - Alignment: edge/center alignment with optional tolerance
  - Equal spacing: `equal-gap-x`/`equal-gap-y` between 2+ targets
  - Count: DOM queries with `any`/`visible`/`absent` scoping
  - Text/CSS: property matching with 5 match modes + text transforms
  - Size: absolute px and relative % comparisons
- Tolerance: ±1px for exact distances, ±0.5px for ranges
- Negation (`not`): inverts pass condition
- Missing elements produce `pass: false` with reason text

### 3.5 Diagnostics Model
- `src/core/types.ts`
- `RunLayoutLintResult` includes optional `diagnostics`
- Each diagnostic includes:
  - stable code
  - severity
  - message
  - source range (start/end index + line/column)
  - optional snippet

Runtime behavior:
- `runLayoutLint()` returns `{ rules, results, diagnostics }`
- valid rules are still evaluated even when diagnostics are present
- consumers can treat diagnostics as non-fatal warnings or blocking errors

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
  - Spec editor surfaces parse diagnostics on invalid apply attempts and keeps editor mode open for correction
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
- **Resolves to**: `dist/devtools/index.js` + `dist/devtools/index.d.ts`
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
- Evaluation logic handles the full rule taxonomy deterministically.
- Alias system (definitions, wildcards, groups) keeps specs readable without coupling to DOM structure.
- Diagnostic pipeline surfaces syntax, extraction, and semantic issues with source locations.
- Demo proves end-to-end viability on real DOM elements.
- TypeScript sources are modular (`core/parser`, `core/dsl`, `core/evaluator`, `core/runtime`, `devtools/*`).

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
