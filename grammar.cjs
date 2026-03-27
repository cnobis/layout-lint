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
      // relative rules: element relation target [distance]
      seq(
        field("element", $.identifier),
        field("relation", $.relation),
        field("target", $.identifier),
        optional(field("distance", $.distance))
      ),
      // ternary equal-gap rules: element relation target target [distance]
      seq(
        field("element", $.identifier),
        field("relation", $.ternary_relation),
        field("target", $.identifier),
        field("target2", $.identifier),
        optional(field("distance", $.distance))
      ),
      // chain equal-gap rules: element relation [target target target ...] [distance]
      seq(
        field("element", $.identifier),
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
        field("relation", $.relation),
        field("distance", $.distance)
      )
    ),

    // relations we support for now
    relation: $ => choice(
      "below", "above", "left_of", "right_of",
      "aligned_top", "aligned_bottom", "aligned_left", "aligned_right",
      "centered_x", "centered_y",
      "contains",
      "wider_than", "taller_than", "same_width", "same_height", "overlaps",
      "distance_from_top"
    ),

    ternary_relation: $ => choice(
      "equal_gap_x",
      "equal_gap_y"
    ),

    // identifiers = simple names (e.g. header, button, loginBtn, featured-badge)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    // distance = number + "px"
    distance: $ => /\d+px/,
  }
});


