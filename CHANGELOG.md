# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`demo/tutorial`**: 8-step guided tour of the DSL. Starts with a deliberately broken layout; each step applies one rule and the relevant element snaps into place via CSS transitions. Covers direction, alignment, containment, defines, percentages, counting, text/CSS assertions, and negation. Replaces the earlier `demo/tour` minimal hero.

### Changed
- **Demos rewritten to match the drop-in story.** The `gallery` and `jazz-club` demos now use the documented two-tag pattern (`<script type="layout-lint">` + `auto.bundle.js`) with no `createLayoutLintMonitor` / `createLayoutLintWidget` imports. Fixture JavaScript only handles user interaction; the default observers re-evaluate automatically. Control Room and Tutorial remain programmatic by design and are labeled as such.
- Auto entry default widget position changed from top-left (`{x:16,y:16}`) to bottom-right (`max(margin, innerWidth-376), max(margin, innerHeight-416)`) so it doesn't collide with page headers on first mount.
- Console reporter now de-duplicates identical pass/fail summaries by default (`createConsoleReporter({ dedupe: false })` to opt out). Eliminates console spam on every resize/mutation when nothing actually changed.
- Spec editor migrated from the deprecated `Language.query()` method to the `new Query(language, source)` constructor (`web-tree-sitter` 0.25+). Removes the deprecation warning that fired every time the Spec tab opened.
- Importmaps removed from all drop-in demos (the bundled `auto.bundle.js` is self-contained).
- Demo set consolidated to four polished fixtures. Removed the older `auto`, `web-component`, `dashboard`, `forms`, and `diagnostics` demo folders.
- Playground landing page (`demo/index.html`) and demo README rewritten to match.

## [1.1.0] - 2026-06-05

### Added
- `layout-lint/auto` side-effect entry. A single `<script type="module" src="…/layout-lint/auto">` finds every `<script type="layout-lint">` block on the page, creates a monitor against the live DOM, and mounts the widget. Controller exposed on `window.layoutLintAuto`.
- `layout-lint/web-component` entry. Registers a `<layout-lint>` custom element. Spec text comes from the element's `textContent` or a `spec` attribute; attribute changes swap the spec live.
- JSX / `HTMLElementTagNameMap` type augmentation for `<layout-lint>` so React, Preact, Solid, and Vue 3 consumers get IntelliSense and no TS errors.
- `dom` option on `createLayoutLint` / `runLayoutLint` for synthetic documents (jsdom, happy-dom, custom).
- Self-contained ESM bundles at `dist/auto.bundle.js` and `dist/web-component.bundle.js` (~478 KiB each, includes inlined grammar WASM + tree-sitter runtime WASM + web-tree-sitter loader). The `./auto` and `./web-component` subpath exports point at the bundles.
- Authoritative DSL reference at [docs/LANGUAGE.md](docs/LANGUAGE.md), linked from the README.

### Changed
- `wasmUrl` and `locateFile` are now optional on every public entry. The grammar WASM and the tree-sitter runtime WASM are base64-inlined into the bundle by default. The previous `wasmUrl is required` throw is removed.
- The devtools widget mounts inside a Shadow DOM root (open mode) instead of `document.body`. Host page selectors (`button { ... }`, `header { ... }`, Tailwind preflight, CSS resets) can no longer deform the widget chrome. The highlight overlay layer is also inside the shadow root.
- `createLayoutLint` returns parse and semantic diagnostics with empty `results` when no DOM is available, instead of throwing.
- README rewritten in drop-in-first order, with explicit production-guard recipes for Vite, Next.js, and Astro.

### Removed
- Vendored `demo/web-tree-sitter.js` shim. Demos now use the npm package directly via an importmap, in line with the published consumer path.
- `example.layout` stub at the repo root.

## [1.0.8] - 2026-03-08

### Changed
- Removed `demo/**` from npm package contents
- Published a minimal runtime package with `dist/**` + `layout_lint.wasm`
- Unpublished `1.0.7` so only `1.0.8` remains available

## [1.0.7] - 2026-03-07

### Changed
- Excluded source files (`src/**`, `grammar.js`) from published package
- Package now ships only compiled code (`dist/**`), WASM binary, and demo
- Reduced package size from 535.4 KB to 522.5 KB
- Source code will be included again in final release version

## [1.0.5] - 2026-03-07

### Fixed
- Installation no longer attempts to run `node-gyp rebuild` (WASM-only package)
- Added explicit install script to inform users that prebuilt WASM is used
- Package now installs cleanly without requiring `--ignore-scripts` flag

## [1.0.0] - 2026-03-07

### Added
- Initial public release
- Tree-sitter grammar for layout constraint DSL
- 14 spatial relations:
  - Directional: `below`, `above`, `left-of`, `right-of`
  - Alignment: `aligned-top`, `aligned-bottom`, `aligned-left`, `aligned-right`
  - Semantic: `contains`, `overlaps`
  - Size comparison: `wider-than`, `taller-than`, `same-width`, `same-height`
  - Absolute positioning: `distance-from-top`
- `runLayoutLint()` API for parsing and evaluating layout specs
- Interactive demo with:
  - Draggable elements for real-time constraint testing
  - Responsive layout testing with viewport resize
  - Live verification widget
- TypeScript definitions
- Hyphen support in element identifiers

### Fixed
- Package exports now correctly point to `dist/index.js`
- Semantic relations (`contains`, `overlaps`) now properly pass only when condition is met

[1.0.8]: https://github.com/cnobis/layout-lint/releases/tag/v1.0.8
[1.0.7]: https://github.com/cnobis/layout-lint/releases/tag/v1.0.7
[1.0.5]: https://github.com/cnobis/layout-lint/releases/tag/v1.0.5
[1.0.0]: https://github.com/cnobis/layout-lint/releases/tag/v1.0.0
[Unreleased]: https://github.com/cnobis/layout-lint/compare/v1.0.8...HEAD
