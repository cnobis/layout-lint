# layout-lint — Brand & Design Tokens

One small, consistent visual language across every layout-lint surface. This is
the single place the palette, type, and shape rules are written down. Keep it in
sync with the two places that consume them (below).

## Where the tokens live (canonical sources)

| Space | File | How it gets the tokens |
| --- | --- | --- |
| Demo playground + demos | [demo/shared.css](../demo/shared.css) | `--ll-*` CSS custom properties on `:root` |
| Under-the-Hood demo page | [demo/internals/styles.css](../demo/internals/styles.css) | re-maps `--ll-*` to the palette below |
| Generated grammar reference | [docs/grammar-theme.css](grammar-theme.css) | injected into `grammar.html` by `scripts/gen-railroad.mjs` |

`demo/shared.css` is the runtime source of truth for the live UI. This document
is the human-readable spec; when a value changes, update `shared.css`,
`grammar-theme.css`, and this table together.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Ink (background) | `#0b1020` | App/selection background, dark header bars |
| Surface | `#111827` | Cards, panels, editor |
| Surface raised | `#1f2937` / `#1f2547` | Hover, active chips |
| Border | `#374151` | Card and panel borders |
| Text | `#e5e7eb` | Primary text on dark |
| Muted text | `#7a86b4` / `#aeb5e9` | Secondary text, labels |
| Accent (brand purple) | `#7a81ff` | Primary accent, focus, links, active state |
| Accent (link, on light) | `#5a61e6` | Links/identifiers on light doc surfaces |
| Accent ink | `#b9c0ff` | Text/icons on dark next to the accent |
| Positive | `#5cffaa` | Pass state |
| Danger | `#ff6b81` | Fail / error state |

Light reading surfaces (the grammar reference) stay on `#ffffff` with `#1f2430`
ink on purpose — a light surface is the right call for a reference you scan. The
brand shows through the accent colour, the type, and the dark header bar, not by
inverting the whole page.

## Type

- **Sans (UI/prose):** `"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif`
- **Mono (code/EBNF/diagram text):** `"JetBrains Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace`

## Shape

- Radius: `12px` cards/panels, `999px` pills/chips.
- Accent glow on active chips: `0 0 0 1px rgba(122,129,255,0.2), 0 0 8px rgba(122,129,255,0.28)`.
- Brand banner: the wordmark logo on the `#7a81ff` purple block (selection screen) or on `#0b1020` ink (doc header bar). Logos live in `demo/images/`.

## Spaces and how branded they are

- **Demo selection + demos** — fully branded, dark, the primary experience.
- **Under-the-Hood demo** — same dark brand as the selection screen.
- **Generated grammar reference** — light, clean documentation layout (from
  `ebnf2railroad`) with a brand header bar and accent/type overrides only.
