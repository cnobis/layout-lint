# layout-lint demo

This folder contains the interactive **art gallery demo** used to validate layout-lint and the devtools overlay workflow.

## Current demo behavior

- parses DSL constraints with tree-sitter wasm
- evaluates constraints against live DOM geometry
- renders a draggable devtools widget with live pass/fail rows
- supports hover highlight preview and multi-pin overlays
- shows source/target labels and directional connector measurements

## Runtime notes

- demo entry: `demo/index.html`
- devtools runtime import: `../dist/devtools.js`
- grammar wasm: `layout_lint.wasm` from project root
- monitor in demo currently uses `observeMutations: false` to avoid self-trigger loops; manual re-evaluation is triggered during badge dragging

## Run

From project root:

```bash
npm run build:ts
npm run serve
```

Open:

```text
http://localhost:8080/demo/
```

## stabilization smoke checklist

After opening the demo:

1. drag the featured badge and confirm rows update live
2. hover a row and confirm overlay preview appears
3. click multiple rows and verify multi-pin overlays stack correctly
4. press `esc` and verify all pins clear
5. scroll and resize to verify labels stay visible and non-overlapping
6. toggle `highlight` and verify overlays hide/show cleanly
