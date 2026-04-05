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

## 4) Safari: Jazz Club page background flickers/glitches

- **Symptom**: On Safari, the Jazz Club demo background appears glitchy/inconsistent during refresh and repaint, while Chromium browsers look stable.
- **Root cause**: Multi-layer CSS gradient backgrounds on the page root can render unreliably in Safari repaint/restore paths.
- **Fix applied**:
  - Replaced complex `body` gradient stack with an explicit **solid base** (`background-color` + `background-image: none`).
  - Added a dedicated DOM texture layer (`#page-texture`) using a repeated inline-SVG pattern.
  - Kept the texture as a simple fixed overlay with `pointer-events: none` and no runtime repaint workaround.
- **Where**: `demo/jazz-club/index.html`.
- **Verification**: Local build passes and visual approach now follows the same Safari-safe pattern used in prior control-room fixes.
- **General principle**: For Safari compatibility, prefer solid page backgrounds plus explicit DOM/SVG texture layers over stacked CSS gradient backgrounds on root elements.

## 5) Widget tab switching becomes slow or unresponsive

- **Symptom**: Switching widget category/page tabs can require multiple clicks, lag heavily, or appear to not apply.
- **Root cause**: Monitor subscription updates rendered widget DOM while mutation observation was active. The widget rerender mutated DOM, which retriggered observer-driven evaluations and caused a feedback loop.
- **Fix applied**:
  - Added a shared paused-render path (`renderBodyWithObserverPaused`) in the widget.
  - Routed both manual rerenders and monitor subscription rerenders through the same pause/resume flow using `try/finally`.
- **Where**: `src/devtools/widget/index.ts`.
- **Verification**: `npm run build:ts && npm test` passes; tab switching no longer re-enters evaluation loops.
- **General principle**: Any internal widget DOM rerender path (including async subscription handlers) must render with mutation observation paused.

## 6) Widget list numbers can duplicate while overlay numbers stay unique

- **Symptom**: In some result sets, two visible list rows show the same badge number (for example `7` and `7`) while overlay labels for those same constraints show distinct numbers (for example `7` and `8`).
- **Root cause**: Row numbering in the widget list resolved indices using key-based lookup only. When two results mapped to the same key identity, both rows resolved to the first matching index.
- **Fix applied**:
  - Updated list numbering to resolve index by object reference first.
  - Kept key-based lookup only as a fallback when reference matching is unavailable.
  - Aligned list-number resolution strategy with the existing overlay-number resolution logic.
- **Where**: `src/devtools/widget/rows.ts` (row numbering in `renderWidgetRows`).
- **Verification**: `npm run build:ts && npm test` passes; list badges now stay in sync with overlay labels.
- **General principle**: For UI labels tied to evaluation order, prefer stable reference/index mapping over derived keys that may collide.

## 7) Unpin-all can leave stale highlight active

- **Symptom**: After clicking `Unpin All`, the previously selected constraint can remain highlighted even though pin count is `0`.
- **Root cause**: Clearing pinned keys did not clear the widget active rule. Highlight rendering then fell back to that lingering active selection.
- **Fix applied**:
  - Updated `clearPinnedRules()` to also reset `activeRule` to `null`.
  - Kept rerender flow unchanged so highlight layer clears naturally after state update.
- **Where**: `src/devtools/widget/state.ts` (`clearPinnedRules`).
- **Verification**: `npm run build:ts && npm test` passes; highlight no longer remains after `Unpin All`.
- **General principle**: Bulk clear actions should reset both collection state (pinned set) and derived/selection state (active item) to avoid stale UI artifacts.

## 8) Widget control buttons flicker and need repeated clicks in some demos

- **Symptom**: In `demo/control-room` and `demo/jazz-club`, hovering `Refresh Results` or `Unpin All` causes vivid flicker, and button actions can require several clicks to trigger.
- **Root cause**: The monitor observes mutations on the full document. Widget button hover/focus style updates mutate widget DOM attributes, which retrigger evaluation/rerender loops while the pointer is still over the controls.
- **Fix applied**:
  - Tagged widget and highlight-layer roots with marker attributes (`data-layout-lint-widget` and `data-layout-lint-widget-overlay`).
  - Filtered mutation callbacks so observer-driven evaluation ignores mutations occurring inside those widget-owned regions.
- **Where**: `src/devtools/widget/index.ts` (marker attributes), `src/devtools/monitor/create-monitor.ts` (mutation filter + observer factory).
- **Verification**: `npm run build:ts && npm test` passes; hover state is stable and single-click actions trigger reliably in control-room/jazz-club demos.
- **General principle**: Global mutation observers must ignore self-owned UI layers to prevent feedback loops from local hover/focus DOM changes.

## 9) VS Code reports ts(2307) for local `.js` specifier imports

- **Symptom**: VS Code shows `Cannot find module './footer-status.js' or its corresponding type declarations.ts(2307)` in `src/devtools/widget/rows.ts` even though `npm run build:ts` succeeds.
- **Root cause**: Language service module-resolution mismatch. The project uses ESM `.js` specifiers in TypeScript source, and VS Code resolution under prior tsconfig settings could flag false-positive local module errors.
- **Fix applied**:
  - Switched TypeScript compiler settings to NodeNext module semantics (`module: "NodeNext"`, `moduleResolution: "NodeNext"`).
  - Kept explicit value/type split imports where appropriate to maximize editor compatibility.
- **Where**: `tsconfig.json`, `src/devtools/widget/rows.ts`.
- **Verification**: `npm run build:ts && npm test` passes; VS Code import diagnostic clears after TS server refresh when needed.
- **General principle**: Align editor/compiler module resolution with runtime ESM import style to avoid IDE-only false positives.


