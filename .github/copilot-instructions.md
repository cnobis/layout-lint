## Thesis Privacy & Workflow

Thesis materials (in `thesis/` and `notes/`) are private and excluded from version control via `.gitignore`. Do not track, edit, or reference these files in the main repository. For detailed thesis workflow and backup/versioning instructions, see `thesis/THESIS_WORKFLOW.md`.

# layout-lint Workspace Instructions

## Project Summary

`layout-lint` is a browser-first DSL for testing spatial relationships between elements. The core flow is grammar parsing, rule extraction, DOM measurement, and optional devtools UI.

## Start Here

Read the project docs before making changes:
- [README.md](../README.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [DEVELOPMENT.md](../DEVELOPMENT.md)
- [BUGS.md](../BUGS.md)
- [PROJECT_STATE.md](../PROJECT_STATE.md)

Link to those docs instead of repeating them in new instructions or comments.

## Build and Test

- Use `npm run build:ts` for TypeScript compilation.
- Use `npm test` for the Node test suite.
- Use `npm run build:wasm` when grammar artifacts need regeneration.
- Use `npm run serve` for the local demo server.

Grammar changes require the documented `tree-sitter generate` workflow in [DEVELOPMENT.md](../DEVELOPMENT.md): temporarily remove `type: module` from [package.json](../package.json), regenerate, then restore it.

## Codebase Layout

- `src/core/` contains parsing, DSL extraction, evaluator, and shared types.
- `src/devtools/` contains the monitor, reporter, settings, and widget UI.
- `demo/` contains browser demos and demo-specific assets.
- `test/` contains the Node-native test suites.

## Conventions

- Keep the runtime ESM/TypeScript style aligned with the current `NodeNext` setup.
- Prefer the existing `node:test` suite over introducing Jest/Vitest.
- Keep changes minimal and preserve generated artifacts only when the task requires them.
- Follow the repo's existing diagnostic, runtime, and widget patterns instead of inventing new abstractions.

## Important Pitfalls

- Pause internal mutation-observer-driven rerenders when the widget edits its own DOM to avoid feedback loops.
- Be careful with Safari-sensitive demo styling; several visual layers use explicit DOM/SVG overlays instead of complex CSS backgrounds.
- When editing the spec editor, use the monitor APIs (`getSpecText`, `setSpecText`, `evaluateNow`) so editor state and diagnostics stay consistent.

## Documentation Discipline

- Do not duplicate the detailed bug log from [BUGS.md](../BUGS.md); add new entries there when you fix a real issue.
- Treat [ARCHITECTURE.md](../ARCHITECTURE.md) as the source for component boundaries and [DEVELOPMENT.md](../DEVELOPMENT.md) as the source for grammar workflow.