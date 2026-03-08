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
`;

const { results } = await runLayoutLint({
  specText: spec,
  wasmUrl: './layout_lint.wasm'
});
```

## License

MIT
