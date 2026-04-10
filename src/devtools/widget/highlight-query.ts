// Inlined highlight query — source of truth is queries/highlights.scm
export const HIGHLIGHTS_SCM = `
; highlights.scm — tree-sitter highlight query for the layout-lint DSL

; ─── Comments ─────────────────────────────────────────────────────────
(comment) @comment

; ─── Keywords ────────────────────────────────────────────────────────
(relation) @keyword
(ternary_relation) @keyword
(visibility_relation) @keyword
(size_property) @keyword
(aligned_axis) @keyword
(aligned_mode) @keyword
(centered_axis) @keyword
(centered_scope) @keyword
(count_scope) @keyword
(direction) @keyword
(match_mode) @keyword
(text_operation) @keyword

"count" @keyword
"near" @keyword
"inside" @keyword
"partially" @keyword
"not" @keyword
"is" @keyword
"to" @keyword
"of" @keyword
"aligned" @keyword
"centered" @keyword
"text" @keyword
"css" @keyword
"define" @keyword
"as" @keyword
"group" @keyword

; ─── Numbers & Units ─────────────────────────────────────────────────
(number) @number
(signed_number) @number
"px" @unit
"%" @unit

; ─── Variables (element identifiers) ─────────────────────────────────
(identifier) @variable
(wildcard_name) @variable
(group_reference) @variable

; ─── Strings ─────────────────────────────────────────────────────────
(quoted_text) @string

; ─── Operators ───────────────────────────────────────────────────────
(comparator) @operator

; ─── Properties ──────────────────────────────────────────────────────
(css_property) @property

; ─── Object patterns (count rules) ───────────────────────────────────
(object_pattern) @variable

; ─── Punctuation ─────────────────────────────────────────────────────
";" @punctuation
"[" @punctuation
"]" @punctuation
"," @punctuation
"/" @punctuation

; ─── Errors ──────────────────────────────────────────────────────────
(ERROR) @error
`;
