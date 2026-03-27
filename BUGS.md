# BUGS

Pitfalls and fixes encountered during development.

## New bug entry template

Use this format for every new bug:

```markdown
## N) <Short bug title>

- **Symptom**: What was observed (including affected demo/page/browser if relevant).
- **Root cause**: Why it happened.
- **Fix applied**:
  - Key change 1
  - Key change 2
- **Where**: `path/to/file` (+ function/section if helpful).
- **Verification**: How we confirmed the fix.
- **General principle**: Reusable lesson to prevent similar bugs.
```

## 1) Safari: RESET button loses color after refresh

- **Symptom**: On Safari, the `RESET` button intermittently loses its red styling after repeated refreshes (often after a few reloads), while Chrome remains stable.
- **Likely cause**: Safari restore/repaint behavior can ignore or partially drop visual state in some refresh/BFCache paths.
- **Fix applied**:
  - Use a **solid color** setup for `#gap-reset` (avoid gradient/complex state dependencies).
  - Set explicit Safari-safe properties: `background-color`, `color`, `-webkit-text-fill-color`, `opacity`, `filter`.
  - Keep the solution CSS-only (no runtime reapply hacks).
- **Where**: `demo/control-room/index.html`.

## 2) Widget pinning extremely slow on control-room demo

- **Symptom**: Clicking to pin/unpin rules in the widget on the control-room demo becomes extremely slow and unresponsive. Works fine on other demos (e.g., gallery).
- **Root cause**: The mutation observer was watching `document.documentElement` (the entire document). When `renderRows()` was called during pinning, it cleared and recreated the widget DOM. This triggered the mutation observer → queued evaluation → ran evaluation → called `renderRows()` → triggered mutations again. This created a feedback loop causing severe performance degradation (DOM mutation → evaluate → render → DOM mutation...).
- **Fix applied**:
  - Added monitor-level observer lifecycle helpers in `src/devtools.ts`: `pauseObserver()` and `resumeObserver()`.
  - Wrapped widget row re-render paths (`onRowClick`, `Escape` clear pins) with pause/resume around `renderRows(...)`.
  - Kept `observeMutations: true` in control-room, so mutation-based auto-evaluation stays available while avoiding the render-loop feedback.
- **Where**: `src/devtools.ts` (observer lifecycle + pin/clear render paths), `demo/control-room/index.html` (monitor config with `observeMutations: true`).
- **General principle**: Keep mutation observation enabled when useful, but pause observer callbacks during internal widget DOM re-renders that should not trigger new evaluations.

## 3) Safari: Centering stage grid intermittently disappears/breaks

- **Symptom**: On Safari, the centering-stage “hacker grid” visuals intermittently render incorrectly (missing grid/glow layers) after refreshes, while other browsers remain stable.
- **Root cause**: Complex multi-layer backgrounds on a single element can be brittle in Safari repaint/restore paths.
- **Fix applied**:
  - Keep `#centering-stage` on a **solid explicit base** (`background-color` + `background-image: none`).
  - Render the grid as an explicit DOM overlay layer (`#centering-grid`) using inline SVG pattern lines (no CSS gradient grid rendering).
  - Avoid pseudo-element/compositing-heavy decoration and avoid CSS-painted grid gradients for this panel.
  - Keep it markup/CSS only (no runtime reapply hacks or JS repaint workarounds).
- **Where**: `demo/control-room/index.html` (`#centering-stage` and `#centering-grid` in both CSS + stage markup).
- **Verification**: Accepted fix after repeated Safari refresh checks; grid remains visible and does not disappear.
- **General principle**: For Safari resilience, prefer explicit DOM/SVG layers for decorative grids over CSS gradient/compositing effects.


