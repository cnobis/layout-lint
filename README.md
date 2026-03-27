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
  sidebar left_of content
  logo1 equal_gap_x logo2 logo3 logo4 2px
`;

const { results } = await runLayoutLint({
  specText: spec,
  wasmUrl: './layout_lint.wasm'
});
```

## Equal gap chains

`equal_gap_x` and `equal_gap_y` support chain syntax so one line can validate many adjacent gaps.

```txt
logo1 equal_gap_x logo2 logo3 logo4 logo5 2px
```

This expands internally to:

- `logo1 equal_gap_x logo2 logo3 2px`
- `logo2 equal_gap_x logo3 logo4 2px`
- `logo3 equal_gap_x logo4 logo5 2px`

Tolerance semantics:

- Passes when `|gap1 - gap2| <= tolerance`
- If omitted, tolerance defaults to `1px`

## License

MIT
