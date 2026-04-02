/**
 * @file layout-lint grammar for tree-sitter
 * @author Christopher Nobis <christophernobis.dev@icloud.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "layout_lint",

  rules: {
    // entry point
    source_file: $ => repeat($.rule),

    // a rule looks like:  <element> <relation> <target> [<distance>]
    // or for absolute rules: <element> <relation> <distance>
    rule: $ => choice(
      // count rules: count any|visible|absent pattern is <range>
      seq(
        "count",
        field("count_scope", $.count_scope),
        field("count_pattern", $.object_pattern),
        "is",
        field("count_exact", $.number)
      ),
      seq(
        "count",
        field("count_scope", $.count_scope),
        field("count_pattern", $.object_pattern),
        "is",
        field("count_comparator", $.comparator),
        field("count_exact", $.number)
      ),
      seq(
        "count",
        field("count_scope", $.count_scope),
        field("count_pattern", $.object_pattern),
        "is",
        field("count_min", $.number),
        "to",
        field("count_max", $.number)
      ),
      // near rules: element near target [distance direction [, ...]] 
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "near",
        field("target", $.identifier),
        repeat1(field("near_clause", $.near_clause))
      ),
      // inside rules: element inside target [signed_distance side [side ...] [, ...]]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "inside",
        field("target", $.identifier),
        optional(repeat1(field("inside_clause", $.inside_clause)))
      ),
      // partially inside rules: element partially inside target [signed_distance side [side ...] [, ...]]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "partially",
        "inside",
        field("target", $.identifier),
        optional(repeat1(field("inside_clause", $.inside_clause)))
      ),
      // visibility rules: element visible|absent
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("visibility_relation", $.visibility_relation)
      ),
      // size rules (absolute): element width|height [<|<=|>|>=] distance
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("size_property", $.size_property),
        optional(field("comparator", $.comparator)),
        field("size_distance_px", $.distance)
      ),
      // text rules: element text is|contains|starts|ends|matches "..."
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "text",
        repeat(field("text_operation", $.text_operation)),
        field("text_match_mode", $.text_match_mode),
        field("text_value", $.quoted_text)
      ),
      // css rules: element css property is|contains|starts|ends|matches "..."
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "css",
        field("css_property", $.css_property),
        field("css_match_mode", $.css_match_mode),
        field("css_value", $.quoted_text)
      ),
      // size rules (relative): element width|height [<|<=|>|>=] percentage of target/width|height
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("size_property", $.size_property),
        optional(field("comparator", $.comparator)),
        field("size_distance_pct", $.percentage),
        "of",
        field("target", $.identifier),
        "/",
        field("target_size_property", $.size_property)
      ),
      // Galen-style alignment syntax: element aligned horizontally|vertically ... target [distance]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "aligned",
        field("aligned_axis", $.aligned_axis),
        field("aligned_mode", $.aligned_mode),
        field("target", $.identifier),
        optional(field("distance", $.distance))
      ),
      // centered syntax sugar: element centered horizontally|vertically|all inside|on target [distance]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        "centered",
        field("centered_axis", $.centered_axis),
        field("centered_scope", $.centered_scope),
        field("target", $.identifier),
        optional(field("distance", $.distance))
      ),
      // relative rules: element relation target [distance]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("relation", $.relation),
        field("target", $.identifier),
        optional(field("distance", $.distance))
      ),
      // ternary equal-gap rules: element relation target target [distance]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("relation", $.ternary_relation),
        field("target", $.identifier),
        field("target2", $.identifier),
        optional(field("distance", $.distance))
      ),
      // chain equal-gap rules: element relation [target target target ...] [distance]
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("relation", $.ternary_relation),
        "[",
        field("chain_target", $.identifier),
        field("chain_target", $.identifier),
        repeat(field("chain_target", $.identifier)),
        "]",
        optional(field("distance", $.distance))
      ),
      // absolute rules: element relation distance
      seq(
        field("element", $.identifier),
        optional(field("negated", "not")),
        field("relation", $.relation),
        field("distance", $.distance)
      )
    ),

    // relations we support for now
    relation: $ => choice(
      "below", "above", "left-of", "right-of",
      "aligned-top", "aligned-bottom", "aligned-left", "aligned-right",
      "wider-than", "taller-than", "same-width", "same-height",
      "distance-from-top"
    ),

    // near clause: distance direction [direction ...] [, ...]
    near_clause: $ => seq(
      field("distance", $.distance),
      field("direction", $.direction),
      repeat(field("direction", $.direction)),
      optional(",")
    ),

    // inside clause: signed_distance side [side ...] [, ...]
    inside_clause: $ => seq(
      field("distance", $.signed_distance),
      field("side", $.inside_side),
      repeat(field("side", $.inside_side)),
      optional(",")
    ),

    // direction: left, right, top, bottom
    direction: $ => choice(
      "left", "right", "top", "bottom"
    ),

    inside_side: $ => choice(
      "left", "right", "top", "bottom"
    ),

    visibility_relation: $ => choice("visible", "absent"),

    count_scope: $ => choice("any", "visible", "absent"),

    centered_axis: $ => choice("horizontally", "vertically", "all"),

    centered_scope: $ => "inside",

    size_property: $ => choice("width", "height"),

    aligned_axis: $ => choice("horizontally", "vertically"),

    aligned_mode: $ => choice("all", "top", "bottom", "left", "right", "centered"),

    comparator: $ => choice("<=", ">=", "<", ">"),

    text_match_mode: $ => choice("is", "contains", "starts", "ends", "matches"),

    css_match_mode: $ => choice("is", "contains", "starts", "ends", "matches"),

    text_operation: $ => choice("lowercase", "uppercase", "singleline"),

    css_property: $ => token(choice(
      /[a-zA-Z_][a-zA-Z0-9_-]*/,
      /--[a-zA-Z0-9_-]+/
    )),

    ternary_relation: $ => choice(
      "equal-gap-x",
      "equal-gap-y"
    ),

    quoted_text: $ => token(seq(
      '"',
      repeat(choice(
        /[^"\\]/,
        /\\./
      )),
      '"'
    )),

    object_pattern: $ => token(/[a-zA-Z_][a-zA-Z0-9_.#*-]*/),

    // identifiers = simple names (e.g. header, button, loginBtn, featured-badge)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    // number = integer
    number: $ => /\d+/,

    // signed number = optional leading minus, integer
    signed_number: $ => /-?\d+/,

    // distance = "Npx" or "N to Mpx"
    distance: $ => choice(
      seq($.number, "to", $.number, "px"),
      seq($.number, "px")
    ),

    // percentage = "N%" or "N to M%"
    percentage: $ => choice(
      seq($.number, "to", $.number, "%"),
      seq($.number, "%")
    ),

    // signed distance = "Npx" or "-Npx"
    signed_distance: $ => seq($.signed_number, "px"),
  }
});


