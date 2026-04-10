/**
 * @file layout-lint grammar for tree-sitter
 * @author Christopher Nobis <christophernobis.dev@icloud.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// ── Helper functions ────────────────────────────────────────────────
// Pure JS conveniences — produce the exact same grammar tree.

/** element [not] prefix shared by all non-count rules
 * @param {any} $
 */
function el($) {
  return seq(
    field("element", choice($.identifier, $.group_reference)),
    optional(field("negated", "not"))
  );
}

/** one-or-more items separated by commas
 * @param {any} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

// ── Grammar ─────────────────────────────────────────────────────────

module.exports = grammar({
  name: "layout_lint",

  word: $ => $.identifier,

  extras: $ => [
    /\s/,
    $.comment,
  ],

  rules: {
    // entry point – each statement (definition, group, or rule) must end with a semicolon
    source_file: $ => repeat(choice(
      seq($.definition, ';'),
      seq($.group_definition, ';'),
      seq($.rule, ';')
    )),

    // ── Definitions & groups ──────────────────────────────────────

    // define <name> as "<selector>";  (name may end with * for multi-element definitions)
    definition: $ => seq(
      "define",
      field("name", choice($.wildcard_name, $.identifier)),
      "as",
      field("selector", $.quoted_text)
    ),

    wildcard_name: $ => /[a-zA-Z_][a-zA-Z0-9_-]*\*/,

    // group <name> as member1, member2, ...;
    group_definition: $ => seq(
      "group",
      field("name", $.identifier),
      "as",
      commaSep1(field("member", $.identifier))
    ),

    // @groupName reference (expands to one rule per group member)
    group_reference: $ => token(seq('@', /[a-zA-Z_][a-zA-Z0-9_-]*/)),

    comment: $ => token(seq('#', /.*/)),

    // ── Rules ─────────────────────────────────────────────────────

    rule: $ => choice(
      $._count_rule,
      $._spatial_rule,
      $._visual_rule,
      $._text_css_rule,
      $._alignment_rule,
    ),

    // ── Count rules ───────────────────────────────────────────────
    // count any|visible|absent <pattern> is <range>

    _count_rule: $ => seq(
      "count",
      field("count_scope", $.count_scope),
      field("count_pattern", $.object_pattern),
      "is",
      choice(
        // exact:        count visible .card is 3
        field("count_exact", $.number),
        // comparator:   count visible .card is >= 3
        seq(field("count_comparator", $.comparator), field("count_exact", $.number)),
        // range:        count visible .card is 1 to 5
        seq(field("count_min", $.number), "to", field("count_max", $.number))
      )
    ),

    // ── Spatial rules ─────────────────────────────────────────────
    // near, inside, partially inside, relative, absolute, ternary, chain

    _spatial_rule: $ => choice(
      // near: element near target <distance direction>[, ...]
      seq(el($), "near", field("target", $.identifier),
        repeat1(field("near_clause", $.near_clause))),
      // inside: element inside target [signed_distance side ...]
      seq(el($), "inside", field("target", $.identifier),
        optional(repeat1(field("inside_clause", $.inside_clause)))),
      // partially inside: element partially inside target [...]
      seq(el($), "partially", "inside", field("target", $.identifier),
        optional(repeat1(field("inside_clause", $.inside_clause)))),
      // relative: element relation target [distance]
      seq(el($), field("relation", $.relation),
        field("target", $.identifier), optional(field("distance", $.distance))),
      // absolute: element relation distance
      seq(el($), field("relation", $.relation),
        field("distance", $.distance)),
      // ternary equal-gap: element relation target target [distance]
      seq(el($), field("relation", $.ternary_relation),
        field("target", $.identifier), field("target2", $.identifier),
        optional(field("distance", $.distance))),
      // chain equal-gap: element relation [target target ...] [distance]
      seq(el($), field("relation", $.ternary_relation),
        "[", field("chain_target", $.identifier), field("chain_target", $.identifier),
        repeat(field("chain_target", $.identifier)), "]",
        optional(field("distance", $.distance))),
    ),

    // ── Visual rules ──────────────────────────────────────────────
    // visibility, size (absolute px), size (relative %)

    _visual_rule: $ => choice(
      // visibility: element visible|absent
      seq(el($), field("visibility_relation", $.visibility_relation)),
      // size (absolute): element width|height [comparator] distance
      seq(el($), field("size_property", $.size_property),
        optional(field("comparator", $.comparator)),
        field("size_distance_px", $.distance)),
      // size (relative): element width|height [comparator] percentage of target/property
      seq(el($), field("size_property", $.size_property),
        optional(field("comparator", $.comparator)),
        field("size_distance_pct", $.percentage), "of",
        field("target", $.identifier), "/",
        field("target_size_property", $.size_property)),
    ),

    // ── Text & CSS rules ──────────────────────────────────────────

    _text_css_rule: $ => choice(
      // text: element text [ops] match_mode "value"
      seq(el($), "text",
        repeat(field("text_operation", $.text_operation)),
        field("text_match_mode", $.match_mode),
        field("text_value", $.quoted_text)),
      // css: element css property match_mode "value"
      seq(el($), "css",
        field("css_property", $.css_property),
        field("css_match_mode", $.match_mode),
        field("css_value", $.quoted_text)),
    ),

    // ── Alignment rules ───────────────────────────────────────────

    _alignment_rule: $ => choice(
      // aligned: element aligned axis mode target [distance]
      seq(el($), "aligned",
        field("aligned_axis", $.aligned_axis),
        field("aligned_mode", $.aligned_mode),
        field("target", $.identifier),
        optional(field("distance", $.distance))),
      // centered: element centered axis scope target [distance]
      seq(el($), "centered",
        field("centered_axis", $.centered_axis),
        field("centered_scope", $.centered_scope),
        field("target", $.identifier),
        optional(field("distance", $.distance))),
    ),

    // ── Terminals ─────────────────────────────────────────────────

    relation: $ => choice(
      "below", "above", "left-of", "right-of",
      "aligned-top", "aligned-bottom", "aligned-left", "aligned-right",
      "wider-than", "taller-than", "same-width", "same-height",
      "distance-from-top"
    ),

    ternary_relation: $ => choice("equal-gap-x", "equal-gap-y"),

    near_clause: $ => seq(
      field("distance", $.distance),
      field("direction", $.direction),
      repeat(field("direction", $.direction)),
      optional(",")
    ),

    inside_clause: $ => seq(
      field("distance", $.signed_distance),
      field("direction", $.direction),
      repeat(field("direction", $.direction)),
      optional(",")
    ),

    direction: $ => choice("left", "right", "top", "bottom"),
    visibility_relation: $ => choice("visible", "absent"),
    count_scope: $ => choice("any", "visible", "absent"),
    centered_axis: $ => choice("horizontally", "vertically", "all"),
    centered_scope: $ => "inside",
    size_property: $ => choice("width", "height"),
    aligned_axis: $ => choice("horizontally", "vertically"),
    aligned_mode: $ => choice("all", "top", "bottom", "left", "right", "centered"),
    comparator: $ => choice("<=", ">=", "<", ">"),
    match_mode: $ => choice("is", "contains", "starts", "ends", "matches"),
    text_operation: $ => choice("lowercase", "uppercase", "singleline"),

    css_property: $ => token(choice(
      /[a-zA-Z_][a-zA-Z0-9_-]*/,
      /--[a-zA-Z0-9_-]+/
    )),

    quoted_text: $ => token(seq(
      '"',
      repeat(choice(/[^"\\]/, /\\./)),
      '"'
    )),

    object_pattern: $ => token(/[a-zA-Z_][a-zA-Z0-9_.#*-]*/),

    // NOTE: identifier must not match trailing * — handled by wildcard_name
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    number: $ => /\d+/,
    signed_number: $ => /-?\d+/,

    distance: $ => choice(
      seq($.number, "to", $.number, "px"),
      seq($.number, "px")
    ),

    percentage: $ => choice(
      seq($.number, "to", $.number, "%"),
      seq($.number, "%")
    ),

    signed_distance: $ => seq($.signed_number, "px"),
  }
});


