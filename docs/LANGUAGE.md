# layout-lint language reference

This document describes the spec language consumed by `createLayoutLint`, `runLayoutLint`, `createLayoutLintMonitor`, the `<layout-lint>` element, and the `layout-lint/auto` script-tag entry. It is the source of truth for syntax and semantics. The grammar lives in [grammar.js](../grammar.js); the evaluator lives in [src/core/evaluator-helpers.ts](../src/core/evaluator-helpers.ts).

## Anatomy of a spec

A spec is a sequence of **statements**. Each statement ends with a semicolon.

```text
define card-* as ".card";
group sections as header, main, footer;

header above main 24px;
main below header 24px;
count visible card-* is >= 3;
```

Three kinds of statements exist: **definitions** (`define`, `group`), **rules** (the spatial / visual / text / count assertions), and **comments**. Order does not matter for correctness — definitions can appear after the rules that use them — but readability is better with definitions first.

## Identifiers

An identifier names one or more DOM elements. Resolution is tried in this order:

1. **Defined name** — matches a `define` statement. Uses the stored selector via `document.querySelector`.
2. **Wildcard defined name** — `card-1`, `card-2` resolve against a `define card-* as "..."` definition. The index is 1-based and uses `querySelectorAll` order.
3. **`id` attribute** — direct match against `document.getElementById`.
4. **Escaped `#id`** — fallback via `CSS.escape` when the identifier contains characters that `getElementById` cannot handle.

Identifiers may contain letters, digits, `_`, and `-`. They may not start with a digit.

### Definitions

```text
define hero as "#hero-section";
define card-* as ".card";
```

`define <name> as "<selector>"` binds an identifier to a CSS selector.

The wildcard form `define name-* as "selector"` declares an indexed family. References like `name-1`, `name-2`, `name-3` resolve to the 1st, 2nd, 3rd matched element.

### Groups

```text
group layout as header, nav, main, footer;
@layout visible;
```

`group <name> as a, b, c` declares a named tuple. The reference `@name` expands at parse time to one copy of the rule per member.

The example above expands to four rules: `header visible; nav visible; main visible; footer visible`.

## Distances, percentages, comparators

| Form | Example | Meaning |
| --- | --- | --- |
| Exact | `20px` | Single value |
| Range | `20 to 30 px` | Inclusive on both ends |
| Percentage | `50%` | Single percentage |
| Percentage range | `30 to 50 %` | Inclusive on both ends |
| Signed | `-5px` | Used in `inside` offsets only |
| Comparator | `< 200px`, `>= 50%` | Strict / inclusive on one side |

Comparators (`<`, `<=`, `>`, `>=`) only appear on `count` and `width`/`height` rules.

## Comments

`# starts a line comment that runs to the end of the line.`

```text
# Layout for the dashboard view
header above nav 0px;  # tight stack
```

## Rule categories

### Spatial — directional

```text
nav below header 20px;
sidebar left-of content;
hero distance-from-top 100px;
```

| Relation | Measures | Passes when |
| --- | --- | --- |
| `above` | `target.top − element.bottom` | gap ≥ N (default 0) |
| `below` | `element.top − target.bottom` | gap ≥ N (default 0) |
| `left-of` | `target.left − element.right` | gap ≥ N (default 0) |
| `right-of` | `element.left − target.right` | gap ≥ N (default 0) |
| `distance-from-top` | `element.top` (no target) | within N (or range) |

`element above target 20px` reads as: *element sits at least 20px above target*. Use a range (`element above target 20 to 30 px`) to require the gap to fall in a window.

### Spatial — alignment

```text
title aligned-left subtitle;
hero aligned-top nav 5px;
card-1 same-width card-2;
hero wider-than nav;
```

| Relation | Measures | Passes when |
| --- | --- | --- |
| `aligned-top` / `aligned-bottom` | absolute edge delta on Y | delta ≤ N (default ≤ 1) |
| `aligned-left` / `aligned-right` | absolute edge delta on X | delta ≤ N (default ≤ 1) |
| `same-width` / `same-height` | absolute size delta | delta ≤ N (default ≤ 1) |
| `wider-than` / `taller-than` | size delta (signed) | element ≥ target + N (default 0) |

The optional number is a tolerance, not a distance. `aligned-top nav 5px` passes when the two tops differ by 5px or less. Use a range for an inner band.

### Spatial — equal-gap

```text
card-1 equal-gap-x card-2 card-3;
chain-1 equal-gap-x [chain-2 chain-3 chain-4 chain-5] 2px;
row-1 equal-gap-y row-2 row-3;
```

Ternary form: three elements, the rule passes when the gap between (1, 2) equals the gap between (2, 3) within N (default 1).

Chain form: `[a b c d]` requires evenly spaced gaps across every consecutive pair.

### Spatial — containment

```text
badge inside hero;
badge inside hero 5px top, 5px bottom;
badge partially inside gallery;
badge inside hero 10px all;
```

`inside <target>` with no offsets requires full containment. With offsets, each side may have a required gap. `partially inside` requires only any overlap.

Offsets accept signed values: `badge inside hero -5px left` means the badge's left edge is allowed to extend 5px past the hero's left edge.

Direction keywords: `left`, `right`, `top`, `bottom`. Use `all` as shorthand for all four.

### Spatial — proximity

```text
textfield near button 10px left;
chip near badge 5 to 15 px right;
icon near label 4px left right;
```

`near <target> <distance> <direction> [direction ...]` measures the gap in each named direction. Multiple distance clauses are separated by commas:

```text
icon near label 4px left, 8px top;
```

### Visibility

```text
header visible;
loading-spinner absent;
nav not visible;
```

`visible` requires the element to exist and have non-zero size and `display`/`visibility` not hidden. `absent` requires either non-existence or non-visible. `not` inverts.

### Size

```text
hero width 1200px;
sidebar width < 320px;
card width 25 to 33 %;
artwork-1 width 100% of artwork-1/width;
thumbnail height >= 80px;
```

Absolute form: `<element> width|height [comparator] <distance>`.

Without comparator: exact match within ±1px. With comparator: standard inequality.

Percentage form: `<element> width|height <percentage> of <target>/width|height`. Measures the element's size as a percentage of the target's size on the named axis.

### Count

```text
count any card-* is 5;
count visible card-* is >= 3;
count visible menu-item is 1 to 5;
count absent error-banner is 0;
```

`count <scope> <pattern> is <expectation>` where:

- `scope`: `any` (all matches), `visible` (matches with non-zero size and visible), `absent` (matches that exist but are hidden, or that fail to resolve).
- `pattern`: a defined name (with or without `-*`), an id, or a literal selector-like token (`.card`, `#hero`, `card-*`).
- `expectation`: exact `is N`, comparator `is >= N`, or range `is N to M`.

### Text

```text
welcome-line text starts "Welcome";
quote-line text lowercase contains "vinyl";
title text singleline matches "^Section \d+$";
```

`<element> text [operations...] <match-mode> "<value>"`.

| Operation | Effect |
| --- | --- |
| `lowercase` | Applies `toLowerCase()` to the element's visible text before matching |
| `uppercase` | Applies `toUpperCase()` |
| `singleline` | Replaces line breaks with single spaces |

| Match mode | Compares actual against value as |
| --- | --- |
| `is` | Strict equality (after operations) |
| `contains` | Substring |
| `starts` | Prefix |
| `ends` | Suffix |
| `matches` | JavaScript `RegExp` |

Visible text is read from `innerText` (with `textContent` as a fallback) and collapsed to single spaces.

### CSS

```text
hero css background-color is "rgb(0, 0, 0)";
hero css --brand-accent starts "#ff";
nav css text-transform matches "^upper";
```

`<element> css <property> <match-mode> "<value>"`.

Property names accept any CSS property, including custom properties (`--brand-accent`). The value is compared against `getComputedStyle(element).getPropertyValue(property)` after whitespace normalisation.

Match modes are the same five as for `text`.

### Aligned (formal)

```text
hero aligned horizontally all sidebar;
title aligned vertically centered subtitle;
header aligned horizontally top nav 5px;
```

`<element> aligned <axis> <mode> <target> [tolerance]`.

| Axis | Mode | Compares |
| --- | --- | --- |
| `horizontally` | `all` | both tops and bottoms |
| `horizontally` | `top` | tops only |
| `horizontally` | `bottom` | bottoms only |
| `horizontally` | `centered` | vertical centres |
| `vertically` | `all` | both lefts and rights |
| `vertically` | `left` | lefts only |
| `vertically` | `right` | rights only |
| `vertically` | `centered` | horizontal centres |

This is an ergonomic alternative to writing the underlying `aligned-top` / `aligned-bottom` / `aligned-left` / `aligned-right` rules separately. The mode `centered` uses centre alignment.

### Centered

```text
modal centered horizontally inside viewport;
toast centered all inside main;
icon centered vertically inside button 2px;
```

`<element> centered <axis> inside <target> [tolerance]`.

| Axis | Compares |
| --- | --- |
| `horizontally` | horizontal centres |
| `vertically` | vertical centres |
| `all` | both centres |

Tolerance defaults to 1px. Use a range for a wider band.

## Negation

Any spatial, visual, text, or CSS rule may insert `not` after the element:

```text
badge not inside header;
hero not visible;
title not text contains "draft";
```

`not` inverts the pass condition. The widget renders the rule with a literal `not` between the element and the relation.

## Pass thresholds at a glance

| Rule kind | Default tolerance | With `N` | With `M to N` |
| --- | --- | --- | --- |
| Directional (above/below/left-of/right-of) | gap ≥ 0 | gap ≥ N | N ≤ gap ≤ M |
| Alignment (aligned-*, same-*, centered, aligned formal) | delta ≤ 1 | delta ≤ N | N ≤ delta ≤ M |
| Wider-than / taller-than | delta ≥ 0 | delta ≥ N | N ≤ delta ≤ M |
| Equal-gap (ternary or chain) | delta ≤ 1 | delta ≤ N | N ≤ delta ≤ M |
| Size with comparator | actual `cmp` N | — | — |
| Size without comparator | \|actual − N\| ≤ 1 | — | — |
| Size with range | — | — | N ≤ actual ≤ M |
| Count with `is N` | actual = N | — | — |
| Count with comparator | actual `cmp` N | — | — |
| Count with range | — | — | N ≤ actual ≤ M |

## Diagnostics

Every diagnostic has a stable `code`. The catalogue lives in [src/core/diagnostic-codes.ts](../src/core/diagnostic-codes.ts) and is exported as `DIAGNOSTIC_CATALOGUE` from `layout-lint/diagnostic-codes`.

| Code | Trigger |
| --- | --- |
| `LL-PARSE-SYNTAX` | The text under the highlighted span does not parse as any known rule shape |
| `LL-PARSE-MISSING` | A required token is missing (e.g. `nav above` with no target) |
| `LL-RULE-MALFORMED` | The rule parses but a required slot could not be filled |
| `LL-SEMANTIC-UNKNOWN-GROUP` | `@name` refers to a group never declared |
| `LL-SEMANTIC-ELEMENT-NOT-FOUND` | An identifier in a rule did not resolve to any DOM element |
| `LL-SEMANTIC-INVALID-PATTERN` | A `matches` rule contains an invalid JavaScript regex |
| `LL-SEMANTIC-RULE-INCOMPLETE` | A structurally valid rule is missing a required field at evaluation time |
| `LL-SEMANTIC-INVALID-TARGET` | The target of a size-percentage rule has zero width or height |
| `LL-SEMANTIC-EVALUATION` | Any other evaluation failure; the original message is preserved |

Use `explainCode(code)` from `layout-lint/diagnostic-codes` to get the long-form explanation.

## Worked example

```text
# Brand the layout with a few names so the rules read like prose.
define hero as "#hero-section";
define nav as "#primary-nav";
define card-* as ".card";
group fold as hero, nav;

# The header stack is tight; the cards live below with breathing room.
hero above nav 0px;
nav above card-1 32 to 64 px;

# Cards are uniformly spaced, three or more visible, and never larger than the hero.
card-1 equal-gap-x [card-2 card-3 card-4] 2px;
count visible card-* is >= 3;
card-1 width <= 100% of hero/width;

# Brand voice and visual chrome.
@fold visible;
hero text starts "Welcome";
hero css background-color is "rgb(15, 23, 42)";
```

This spec exercises one of each rule family: definitions, groups, directional with range, equal-gap chain, count with comparator, size percentage with comparator, group reference, text prefix, and CSS exact match.
