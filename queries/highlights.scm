; highlights.scm — tree-sitter highlight query for the layout-lint DSL
; Maps CST node types to highlight capture names used by the editor themes.

; ─── Comments ─────────────────────────────────────────────────────────
(comment) @comment

; ─── Keywords ────────────────────────────────────────────────────────
; Relation keywords
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

; Bare keyword literals in rules
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

; ─── Numbers & Units ─────────────────────────────────────────────────
(number) @number
(signed_number) @number
"px" @unit
"%" @unit

; ─── Variables (element identifiers) ─────────────────────────────────
(identifier) @variable

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
