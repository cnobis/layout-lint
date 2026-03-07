# LayoutLint

<img width="1966" height="252" alt="logo" src="https://github.com/user-attachments/assets/cc27bec9-9574-49da-8880-8761a77bdce7" />

**A declarative DSL for testing CSS layout constraints in the browser.**

LayoutLint lets you write human-readable rules to verify spatial relationships between DOM elements—perfect for visual regression testing, design QA, and ensuring layouts behave correctly across viewport sizes.

---

## Features

- **Declarative DSL**: Write constraints like `gallery below nav 5px` instead of brittle DOM queries
- **14 spatial relations**: directional, alignment, containment, overlap, size comparison
- **Real-time validation**: Evaluates against live DOM geometry using `getBoundingClientRect()`
- **Interactive demo**: Drag elements and resize viewport to see constraints update dynamically
- **Powered by Tree-sitter**: Fast, robust parsing with a custom grammar

[→ **Live Demo**](https://cnobis.github.io/layout-lint/demo/)

---

## Installation

```bash
npm install tree-sitter-layout-lint
```

---

## Quickstart

```typescript
import { runLayoutLint } from 'tree-sitter-layout-lint';

const spec = `
  nav below header 20px
  sidebar left_of content 0px
  footer contains copyright
`;

const { rules, results } = await runLayoutLint({
  specText: spec,
  wasmUrl: '/path/to/layout_lint.wasm'
});

results.forEach(r => {
  console.log(`${r.pass ? '✓' : '✗'} ${r.element} ${r.relation} ${r.target}`);
});
```

---

## Supported Relations

| **Category**       | **Relations**                                    | **Example**                     |
|--------------------|--------------------------------------------------|---------------------------------|
| **Directional**    | `below`, `above`, `left_of`, `right_of`          | `nav below header 10px`         |
| **Alignment**      | `aligned_top`, `aligned_bottom`, `aligned_left`, `aligned_right` | `logo aligned_left nav`         |
| **Semantic**       | `contains`, `overlaps`                           | `modal overlaps page`           |
| **Size**           | `wider_than`, `taller_than`, `same_width`, `same_height` | `sidebar wider_than 200px`      |
| **Absolute**       | `distance_from_top`                              | `header distance_from_top 0px`  |

All directional relations accept an optional distance threshold in pixels (e.g., `≥10px`). Alignment relations use a 1px tolerance. Semantic relations (`contains`, `overlaps`) are boolean.

---

## API Reference

### `runLayoutLint(options)`

Parses a layout spec and evaluates it against the current DOM.

**Options:**
- `specText` (string, required): The layout rules DSL
- `wasmUrl` (string, required): Path to `layout_lint.wasm` file
- `resolve` (function, optional): Custom element resolver (default: `document.getElementById`)
- `locateFile` (function, optional): Custom WASM loader path resolver

**Returns:** `Promise<{ rules: Rule[], results: RuleResult[] }>`

**Types:**
```typescript
interface Rule {
  element: string;
  relation: string;
  target?: string;
  distancePx?: number;
}

interface RuleResult extends Rule {
  actual: number | null;
  pass: boolean;
  reason?: string;
}
```

---

## DSL Syntax

```
<element> <relation> <target> [distance]
<element> <relation> [distance]  // for absolute rules
```

**Examples:**
```
nav below header 0px
gallery below nav 5px
sidebar left_of content 10px
header contains logo
modal overlaps page
footer distance_from_top 500px
```

**Element identifiers** must match DOM element IDs. Hyphens are supported (`featured-badge`, `nav-bar`).

---

## Interactive Demo

The included demo showcases:
- **Draggable elements**: Move a floating badge to test overlap constraints in real-time
- **Responsive testing**: Resize the viewport to see directional rules toggle (e.g., `right_of` → `below`)
- **Live evaluation**: All constraints re-evaluate on interaction

Run locally:
```bash
git clone https://github.com/cnobis/layout-lint
cd layout-lint
npm install
npm run build:ts && npm run build:wasm
npm run serve
# Open http://localhost:8080/demo/
```

---

## Use Cases

- **Visual regression testing**: Assert layout properties in automated test suites
- **Design QA**: Validate designs match implementation without pixel-perfect screenshots
- **Responsive design**: Test breakpoint behavior with viewport-dependent rules
- **Component testing**: Verify spacing, alignment, and containment in isolation

---

## Browser Support

Requires ES modules and `getBoundingClientRect()` support. Works in all modern browsers (Chrome 61+, Firefox 60+, Safari 11+, Edge 16+).

---

## Contributing

Contributions welcome! See [DEVELOPMENT.md](./DEVELOPMENT.md) for build instructions and grammar development workflow.

---

## License

MIT © 2026 Christopher Nobis
