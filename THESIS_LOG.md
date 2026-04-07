# Thesis Implementation Log

Chronological record of implementation decisions, experiments, and rollbacks relevant to the master's thesis.

---

## 2026-04-07 — Tree-Sitter Syntax Highlighting for the Spec Editor

### What was built
Replaced the naive keyword-list highlighter in the in-browser spec editor with real tree-sitter-powered syntax highlighting using the web-tree-sitter Query API.

**Architecture:**
- `src/core/parser.ts` — new `getLanguage()` export shares the same WASM init promise as `getParser()`
- `queries/highlights.scm` — declarative tree-sitter query mapping 15+ node types to 9 capture groups (`@keyword`, `@number`, `@unit`, `@variable`, `@string`, `@operator`, `@property`, `@punctuation`, `@error`)
- `src/devtools/widget/tree-sitter-highlight.ts` — bridge module with incremental parsing (`tree.edit()` + re-parse), capture-to-CSS class mapping, and gap filling
- `src/devtools/widget/highlighted-editor-view.ts` — `setHighlighter()` method added; priority chain: external tokens > tree-sitter > naive fallback
- 7 new token CSS classes across all 4 editor themes (dark, light, warm, dusk)
- Graceful degradation: if WASM fails to load, the naive keyword highlighter continues working

**Key design decisions:**
- Inlined `.scm` query as a TypeScript string constant (no runtime fetch); `queries/highlights.scm` is canonical source of truth
- Async init, sync tokenize — WASM loads once, then zero-latency per keystroke
- `wasmUrl` and `locateFile` threaded through `WidgetOptions` → `createSpecEditor` → highlighter init

**Thesis angles:**
- Incremental parsing in the browser — `tree.edit()` + re-parse vs full re-parse, measuring keystroke-to-render latency
- Declarative highlight queries — `.scm` query language as a pattern-matching abstraction over CSTs
- Comparison with naive tokenization — before/after accuracy, coverage of grammar constructs
- Browser WASM constraints — loading latency, memory, textarea+overlay architecture interaction

---

## 2026-04-07 — Error Recovery Bleed: Attempted Line-Scoped Capping (Reverted)

### Problem observed
When typing an incomplete rule (e.g., lone `d` on a line), tree-sitter's error recovery is greedy — it creates an ERROR node that consumes tokens from subsequent lines, making valid rules like `gallery below nav 5px` appear broken.

### Attempted fix
Line-scoped error capping in `tree-sitter-highlight.ts`: if an ERROR capture spans multiple lines, clamp its highlight to only the first line. Code checked `node.startPosition.row < node.endPosition.row` and truncated `end` to the next `\n`.

### Why it was reverted
The clamping didn't work correctly in practice — the tokens consumed by the ERROR node on subsequent lines were still "stolen" from the query captures, so they didn't get re-highlighted even though the error visual was clamped. The problem is at the parser level (the CST structure), not the presentation layer.

### Root cause insight
Tree-sitter's `repeat($.rule)` has no explicit delimiter between rules. Without a terminator like `;` or a newline token, the parser can't tell where one broken rule ends and the next begins, so error recovery bleeds freely.

### Thesis angle: Delimiter Design and Error Recovery Granularity
A grammar with explicit delimiters (e.g., `seq($.rule, ';')`) would confine ERROR nodes to single statements. The current newline-implicit design is cleaner for users (no trailing semicolons) but fundamentally limits error isolation. This is a classic DSL design tradeoff:
- **No delimiter** — cleaner syntax, worse error recovery
- **Semicolons** — familiar (CSS, Galen), precise error boundaries

---

## 2026-04-07 — Mandatory Semicolons Added to Grammar

### What changed
Changed `source_file: $ => repeat($.rule)` to `source_file: $ => repeat(seq($.rule, ';'))` in `grammar.js`, making `;` a mandatory rule terminator.

**Files modified:**
- `grammar.js` — grammar rule change
- `src/parser.c`, `src/grammar.json`, `src/node-types.json` — regenerated via `tree-sitter generate`
- `layout_lint.wasm` — rebuilt via `npm run build:wasm`
- `queries/highlights.scm` + `src/devtools/widget/highlight-query.ts` — added `";" @punctuation`
- `demo/gallery/index.html`, `demo/jazz-club/index.html`, `demo/control-room/index.html` — all spec rules now end with `;`
- `example.layout` — updated
- `test/spec-editor-apply.test.js` — spec strings updated for consistency

**No changes needed in DSL extraction:** `extractRules()` iterates `root.namedChild(i)`, which skips anonymous `;` nodes automatically. The `collectSyntaxDiagnostics()` traversal also ignores non-ERROR/MISSING nodes.

### Why mandatory (not optional)
Optional semicolons (`optional(';')`) would improve error recovery for users who include them, but the parser would still be ambiguous when they're omitted — the same bleed problem would persist for specs without semicolons. Mandatory semicolons give the parser a definitive rule boundary, fully confining ERROR nodes.

### Thesis angle: Grammar Delimiter Impact on Error Recovery
This is a direct follow-up to the reverted capping attempt. The fix at the grammar level (adding explicit delimiters) is the correct solution for error recovery isolation. The tree-sitter parser can now confine errors between semicolons, preventing cross-rule token consumption. This demonstrates that error recovery quality is a grammar-design concern, not a presentation-layer concern — a key finding for the thesis analysis of DSL tooling.
- **Newline-as-token** — possible via tree-sitter external scanners, but adds complexity
- Compare with Python (newline-significant), Go (auto-semicolons), Rust (explicit semicolons)
