# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Directional: `below`, `above`, `left_of`, `right_of`
  - Alignment: `aligned_top`, `aligned_bottom`, `aligned_left`, `aligned_right`
  - Semantic: `contains`, `overlaps`
  - Size comparison: `wider_than`, `taller_than`, `same_width`, `same_height`
  - Absolute positioning: `distance_from_top`
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
