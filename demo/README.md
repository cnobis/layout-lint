# layout-lint demo

This folder contains the demo set for validating layout-lint and the devtools overlay workflow.

## Playground

- playground page: `demo/index.html`
- root landing page: `demo/index.html`
- active gallery demo: `demo/gallery/index.html`
- scaffolded pages for expansion:
	- `demo/dashboard/index.html`
	- `demo/control-room/index.html`
	- `demo/forms/index.html`
	- `demo/jazz-club/index.html`
	- `demo/editor/index.html`

## active demo pages

- `demo/gallery/index.html`
- `demo/dashboard/index.html`
- `demo/control-room/index.html`
- `demo/forms/index.html`
- `demo/jazz-club/index.html`
- `demo/editor/index.html`

## Current demo behavior

- parses DSL constraints with tree-sitter wasm
- evaluates constraints against live DOM geometry
- renders a draggable devtools widget with live pass/fail rows
- supports hover highlight preview and multi-pin overlays
- shows source/target labels and directional connector measurements

## Runtime notes

- demo entry: `demo/index.html` (Playground landing)
- gallery entry: `demo/gallery/index.html`
- jazz club entry: `demo/jazz-club/index.html`
- devtools runtime import: `../dist/devtools/index.js`
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
http://localhost:8080/demo/index.html
```

## stabilization smoke checklist

After opening the demo:

1. drag the featured badge and confirm rows update live
2. hover a row and confirm overlay preview appears
3. click multiple rows and verify multi-pin overlays stack correctly
4. press `esc` and verify all pins clear
5. scroll and resize to verify labels stay visible and non-overlapping
6. toggle `highlight` and verify overlays hide/show cleanly

## extension-driven workflow

Yes, language work should be driven by concrete demo needs. use this cycle:

1. pick one demo page and define the layout intent you cannot currently express
2. write the desired DSL examples first (even if unsupported yet)
3. extend grammar + parser + evaluator minimally to satisfy those examples
4. validate on at least two demos before considering the extension stable
5. add tests and capture demo screenshots as evidence

This keeps extensions justified, avoids feature sprawl, and produces stronger thesis artifacts.
