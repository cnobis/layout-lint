/**
 * @file LayoutLint grammar for tree-sitter
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

    // a rule looks like:  <element> <relation> <target> <distance>
    rule: $ => seq(
      field("element", $.identifier),
      field("relation", $.relation),
      field("target", $.identifier),
      field("distance", $.distance)
    ),

    // relations we support for now
    relation: $ => choice("below", "above", "left_of", "right_of"),

    // identifiers = simple names (e.g. header, button, loginBtn)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // distance = number + "px"
    distance: $ => /\d+px/,
  }
});


