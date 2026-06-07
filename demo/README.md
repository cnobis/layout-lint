# layout-lint demos

Four fixtures: one guided tutorial, two drop-in showcases, and one power-user lab.

| Folder | Mode | Focus |
| --- | --- | --- |
| [tutorial](./tutorial/) | programmatic | Learn the DSL in 8 guided rules; the broken layout snaps into place as you apply each one |
| [gallery](./gallery/) | drop-in | Spatial composition: `inside`, `partially inside`, percent-of widths, wildcards, groups |
| [jazz-club](./jazz-club/) | drop-in | Text and CSS assertions: `text starts/ends/matches`, `css ... contains`, `count visible` |
| [control-room](./control-room/) | programmatic | Builds the monitor by hand and swaps the spec live on every preset change |

## How the drop-in demos are wired

Both drop-in demos use the same two tags you'd ship in production:

```html
<script type="layout-lint">
  card-a left-of card-b 14px;
</script>
<script type="module" src=".../layout-lint/auto"></script>
```

That's it. No imports, no `createLayoutLintMonitor`, no reporter wiring. The auto entry finds every `<script type="layout-lint">` block, mounts the widget bottom-right, and starts evaluating. Default observers (resize + mutation) pick up any DOM change the fixture makes, so the demo's fixture JS only contains interaction logic, never library setup.

The demos point at `../../dist/auto.bundle.js` so they work offline; in production swap that path for `https://esm.sh/layout-lint/auto` or your bundled npm import.

## How the programmatic demos are wired

The Tutorial and Control Room demos drive the monitor by hand because they need to rewrite the spec live (the tutorial grows it rule-by-rule; control-room swaps it on every preset). Both use `createLayoutLintMonitor` + `createLayoutLintWidget` directly from `../../dist/devtools/index.js`. This is also a useful reference if you ever need to drive the monitor yourself from a framework.

## Run

```bash
npm run build:ts
npm run serve
# open http://localhost:8080/demo/
```

Each demo has an **EXIT DEMO** button in the top-right that returns to the playground.

## Smoke checklist

1. Open a demo and confirm the widget appears (bottom-right by default).
2. Hover a row: the target overlay should pulse over the element.
3. Click multiple rows: pins stack and persist.
4. Press `Esc`: all pins clear.
5. Resize the window: rows re-evaluate within ~100ms.
6. Open the **Spec** tab, edit a rule, and watch the row flip.
