# TODO

## Web Component API

Plan a Web Component wrapper for the widget so it can be embedded declaratively without framework-specific wrappers.

### Likely work items
- Keep `runLayoutLint(...)` as the core imperative API.
- Add a `<layout-lint-widget>` custom element wrapper around the existing widget.
- Make the component accept `specText`, `wasmUrl`, and widget options such as position, minimized state, tabs, and persistence.
- Wire the custom element into the public devtools entry so consumers can import it cleanly.
- Keep the existing direct widget API as the lower-level escape hatch.
- Update the README with the new component-based usage.

### Intended outcome
- Easy browser embedding.
- No framework-specific wrappers.
- Better declarative integration while preserving the current imperative API.
