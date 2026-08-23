# layout-lint demos

Four pages: a guided tutorial and three drop-in demos that grow harder to hold together.

| Folder | Focus |
| --- | --- |
| [tutorial](./tutorial/) | The DSL in eight guided rules. A broken layout snaps into place as each one is applied. |
| [gallery](./gallery/) | Containment and sizing: `inside` with offsets, `partially inside`, percent-of widths, wildcards, groups. |
| [bar](./bar/) | Text, CSS, visibility, and count: `text starts/ends/matches`, `css ... contains`, `visible`, `absent`, `count`. |
| [studio](./studio/) | Alignment and proximity on a mixing desk: `aligned`, `centered`, `equal-gap`, `near`. |

The three drop-in demos ship the same two tags a production page would, a `<script type="layout-lint">` block and the auto entry, and nothing else. They point at `../../dist/auto.bundle.js` so they run offline. The tutorial instead drives `createLayoutLintMonitor` and `createLayoutLintWidget` directly, because it rewrites the spec as the reader advances.

## Run

```bash
npm run build:ts
npm run serve
# http://127.0.0.1:8080/demo/
```
