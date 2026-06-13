# layout-lint demos

Four pages: one guided tutorial and three drop-in demos that get progressively harder to hold together.

| Folder | Mode | Focus |
| --- | --- | --- |
| [tutorial](./tutorial/) | programmatic | Learn the DSL in 8 guided rules; the broken layout snaps into place as you apply each one |
| [gallery](./gallery/) | drop-in | Containment and sizing: `inside` with offsets, `partially inside`, percent-of widths, wildcards, groups |
| [bar](./bar/) | drop-in | Text, CSS, visibility and count: `text starts/ends/matches`, `css ... contains`, `visible`/`absent`, `count` |
| [studio](./studio/) | drop-in | Alignment and proximity on a web mixing desk: `aligned`, `centered`, `equal-gap`, `near`, percent-of |

## How the drop-in demos are wired

All three demos use the same two tags you'd ship in production:

```html
<script type="layout-lint">
  card-a left-of card-b 14px;
</script>
<script type="module" src=".../layout-lint/auto"></script>
```

That's it. No imports, no `createLayoutLintMonitor`, no reporter wiring. The auto entry finds every `<script type="layout-lint">` block, mounts the widget bottom-right, and starts evaluating. Default observers (resize + mutation) pick up any DOM change the fixture makes, so the demo's fixture JS only contains interaction logic, never library setup.

The demos point at `../../dist/auto.bundle.js` so they work offline; in production swap that path for `https://esm.sh/layout-lint/auto` or your bundled npm import.

## How the tutorial is wired

The Tutorial drives the monitor by hand because it rewrites the spec live, growing it rule-by-rule as you advance. It uses `createLayoutLintMonitor` + `createLayoutLintWidget` directly from `../../dist/devtools/index.js`. This is also a useful reference if you ever need to drive the monitor yourself from a framework.

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
