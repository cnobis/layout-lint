module.exports = grammar({
  name: 'layoutlint',

  rules: {
    source_file: $ => repeat($.rule),

    rule: $ => seq(
      field('element', $.identifier),
      field('relation', $.relation),
      field('target', $.identifier),
      optional(field('distance', $.distance))
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,
    relation: $ => choice('below', 'above', 'inside', 'aligned'),
    distance: $ => /\d+px/
  }
});
