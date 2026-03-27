# Development Workflow: Adding Features to layout-lint

## Quick Summary
To add a new relation or feature, follow this sequence. The critical step is **removing/restoring `"type": "module"`** from `package.json` around tree-sitter generation.

Bug tracking policy: document every bug and its solution in [BUGS.md](BUGS.md).

---

## 1. Add a New Relation to the Grammar

Edit [grammar.js](grammar.js) → `relation` rule, e.g.:

```javascript
relation: $ => choice(
  "below", "above", "left_of", "right_of",
  "aligned_top", "aligned_bottom", "aligned_left", "aligned_right",
  "centered_x", "contains"  // ← new relation
),
```

---

## 2. Regenerate the Parser

**Step A: Remove `"type": "module"` from [package.json](package.json)**
This allows `tree-sitter generate` to load [grammar.js](grammar.js) as CommonJS.

**Step B: Run the generator**
```bash
tree-sitter generate
```

**Step C: Restore `"type": "module"` to [package.json](package.json)**
This re-enables ESM for the rest of the build.

---

## 3. (Optional) Add Evaluation Logic

If your relation needs custom measurement logic, edit [src/evaluator.ts](src/evaluator.ts) → `measure()` function:

```typescript
function measure(relation: string, a: HTMLElement | null, b: HTMLElement | null): number | null {
  const A = rect(a), B = rect(b);
  if (!A || !B) return null;
  switch (relation) {
    // ... existing cases ...
    case "contains":     return some_calculation(A, B);  // ← new logic
    default:             return null;
  }
}
```

---

## 4. Rebuild Everything

```bash
npm run build:ts      # Compile TypeScript sources
npm run build:wasm    # Build WASM grammar binary
npm run serve         # Start dev server (kills old instance first)
```

Then **hard refresh the demo** (`Cmd+Shift+R`) to test.

---

## 5. Add Test Cases to a Demo Page

Edit a dedicated demo page (for Stage 2 use [demo/control-room/index.html](demo/control-room/index.html)) → `<pre id="spec">` section:

```html
<pre id="spec" hidden>
hero-copy centered_x hero
hero-cta centered_x hero
hero-cta below hero-copy 32px
trust-strip below hero 24px
</pre>
```

---

## Full Iteration Loop (Fast)

```bash
# Edit grammar.js
# Remove "type": "module" from package.json
tree-sitter generate

# Restore "type": "module" to package.json
# Edit src/evaluator.ts (if needed)
# Edit a target demo page (e.g. demo/control-room/index.html)
npm run build:ts && npm run build:wasm && npm run serve

# Hard refresh browser → test
```

**Time: ~30 seconds (after grammar change).**

---

## Using the Devtools Layer

### Integrating the Monitor + Widget

For interactive development, use the devtools module to enable live constraint testing:

```typescript
import { createLayoutLintMonitor, createLayoutLintWidget, createConsoleReporter } from 'layout-lint/devtools';

// initialize live monitor with your spec
const monitor = createLayoutLintMonitor({
  specText: getSpecFromPage(),  // your DSL spec
  wasmUrl: './layout_lint.wasm',
  reporters: [createConsoleReporter()],  // optional console logging
  observeResize: true,           // re-evaluate on resize
  observeMutations: true,        // re-evaluate on DOM changes
  debounceMs: 80                 // debounce time
});

// create the interactive widget (auto-mounts to document.body)
const widget = createLayoutLintWidget(monitor, {
  title: 'Layout Constraints',
  initialPosition: { x: 24, y: 24 }
});

widget.setVisible(true);
```

### Current widget behavior (stabilized)

- Hovering a row previews highlight overlays for that rule.
- Clicking rows toggles **multi-pin** mode (pin/unpin multiple constraints).
- Press `esc` to clear all pins.
- Header shows `pin: N` for pinned constraint count.
- Header toggle `highlight: on/off` controls overlay visibility.
- Overlay labels are viewport-clamped and collision-aware.

### Subscribing to Monitor Updates

Custom subscribers can listen to monitor changes:

```typescript
monitor.subscribe((results) => {
  console.log('Constraints updated:', results);
  // update custom UI, logging, etc.
});
```

### Customizing the Reporter

Create a custom reporter for specialized logging:

```typescript
const customReporter = (results) => {
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  console.log(`✓ ${passed} / ✗ ${failed}`);
};

const monitor = createLayoutLintMonitor({
  specText: spec,
  wasmUrl: './layout_lint.wasm',
  reporters: [customReporter]  // Use custom reporter
});
```

### Widget Options

The widget accepts configuration:

```typescript
interface LayoutLintWidgetOptions {
  title?: string;                    // Widget title (default: 'layout-lint')
  initialPosition?: { x: number; y: number };  // Starting position
}
```

### Widget Controller API (Quick Reference)

`createLayoutLintWidget(...)` returns a controller with:

```typescript
interface LayoutLintWidgetController {
  destroy(): void;                  // Unsubscribe and remove widget from DOM
  setVisible(visible: boolean): void; // Show/hide widget
}
```

Example:

```typescript
const widget = createLayoutLintWidget(monitor, {
  title: 'Layout Constraints',
  initialPosition: { x: 24, y: 24 }
});

widget.setVisible(false); // Hide
widget.setVisible(true);  // Show
// widget.destroy();      // Cleanup when done
```

### Stabilization regression checklist

Run this checklist before starting new language extensions:

1. Build passes:
  ```bash
  npm run build:ts
  ```
2. Core tests pass:
  ```bash
  npm test
  ```
3. Demo smoke test (`npm run serve`, open `http://localhost:8080/demo/catalog.html`):
  - drag gallery badge and confirm live re-evaluation
  - open control-room demo and adjust spacing sliders to confirm `centered_x`/`equal_gap_x` pass/fail flips live
  - hover a row and confirm source/target/connector overlays
  - pin multiple rows and verify all pinned overlays render together
  - press `esc` and confirm all pins clear
  - scroll/resize and confirm labels stay visible and non-overlapping
  - toggle `highlight` off/on and confirm overlays hide/show cleanly

Capture screenshots for thesis evidence after this pass.

---

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| `tree-sitter generate` fails with `module is not defined` | Remove `"type": "module"` from `package.json` before running |
| Grammar changes don't appear in WASM | Ensure `npm run build:wasm` ran AFTER `tree-sitter generate` |
| Browser still shows old results | Hard refresh (`Cmd+Shift+R`), not soft refresh |
| Evaluation returns `NaN` for new relation | Add `case "xxx": ...` to `measure()` in evaluator.ts |

---

## Files to Always Sync

- [grammar.js](grammar.js) — DSL syntax definition
- [src/grammar.json](src/grammar.json) — Generated from grammar.js
- [src/parser.c](src/parser.c) — Generated from grammar.js
- [src/evaluator.ts](src/evaluator.ts) — Evaluation logic for relations
- [dist/](dist/) — Compiled JS output (generated by `npm run build:ts`)
- [layout_lint.wasm](layout_lint.wasm) — WASM binary (generated by `npm run build:wasm`)

---

## Publishing and Packaging

### What Gets Published

The `files` array in [package.json](package.json) controls what's included in the npm package:

```json
"files": [
  "dist/**",           // Compiled JavaScript + TypeScript definitions
  "layout_lint.wasm",  // WASM parser binary
  "demo/**"            // Interactive demo (includes demo WASM)
]
```

**Source code exclusion** (`src/**`, `grammar.js`): During development, source files are excluded to ship only compiled code. For final release, add them back for full transparency.

### Publishing Workflow

1. **Build everything**:
   ```bash
   npm run build:ts && npm run build:wasm
   ```

2. **Bump version** in [package.json](package.json):
   ```json
   "version": "1.0.x"  // Increment patch/minor/major
   ```

3. **Publish to npm**:
   ```bash
   npm publish --access public
   ```

   **Note**: Requires npm authentication token with "Bypass 2FA" enabled in ~/.npmrc

4. **Verify published package**:
   ```bash
   npm view layout-lint@1.0.x
   npm pack layout-lint@1.0.x  # Download to inspect contents
   tar -tzf layout-lint-1.0.x.tgz | less
   ```

### Version Management

**Unpublish a version** (only within 72 hours):
```bash
npm unpublish layout-lint@1.0.x
```

**View all published versions**:
```bash
npm view layout-lint versions
```

**Deprecate old versions** (without removing):
```bash
npm deprecate layout-lint@"<1.0.x" "Please upgrade to 1.0.x or later"
```

### Install Script Override

The package includes this install script to prevent npm from auto-injecting `node-gyp rebuild`:

```json
"scripts": {
  "install": "echo 'Nothing to build - using prebuilt WASM'"
}
```

This is necessary because tree-sitter packages trigger automatic native build detection. Since layout-lint is WASM-only, we override with a harmless message.

### Testing Installation

```bash
# Test in fresh directory
cd /tmp && mkdir test-pkg && cd test-pkg
npm install layout-lint@1.0.x
node -e "import('layout-lint').then(m => console.log(Object.keys(m)))"
```

### Final Release Checklist

Before thesis submission:
- [ ] Add `"src/**"` and `"grammar.js"` back to `files` array
- [ ] Bump to 1.1.0 or 2.0.0 for official release
- [ ] Update README with complete documentation
- [ ] Publish with full source transparency
- [ ] Create GitHub release with changelog
