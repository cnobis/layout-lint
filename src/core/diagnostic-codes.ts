export interface DiagnosticExplanation {
  title: string;
  explain: string;
}

export const DIAGNOSTIC_CATALOGUE: Record<string, DiagnosticExplanation> = {
  "LL-PARSE-SYNTAX": {
    title: "Invalid spec syntax",
    explain: [
      "The parser could not match the highlighted segment against any known",
      "rule shape. Most often this is a misspelled keyword, a misplaced",
      "operator, or an unfinished rule from the line above bleeding into",
      "this one. Check the keyword set listed in the language reference and",
      "the rule shape examples in Chapter 3.",
    ].join(" "),
  },
  "LL-PARSE-MISSING": {
    title: "Missing semicolon",
    explain: [
      "A required token was absent where the parser expected one. In",
      "layout-lint this almost always means a missing semicolon: every",
      "statement must end with `;`.",
    ].join(" "),
  },
  "LL-RULE-MALFORMED": {
    title: "Malformed rule",
    explain: [
      "The rule node parsed without a syntax error but does not carry both",
      "a subject element and a relation keyword. A valid rule must name an",
      "element, then a relation such as `above` or `inside`, then any",
      "required operands.",
    ].join(" "),
  },
  "LL-SEMANTIC-UNKNOWN-GROUP": {
    title: "Unknown group reference",
    explain: [
      "The rule references a group that was never declared with `define`.",
      "Either add the missing definition or fix the typo. Group names are",
      "case-sensitive and the wildcard suffix `*` is part of the name.",
    ].join(" "),
  },
  "LL-SEMANTIC-ELEMENT-NOT-FOUND": {
    title: "Element not present in DOM",
    explain: [
      "The rule names an element that does not resolve to any node in the",
      "page being checked. Either the selector or id is wrong, or the",
      "element is rendered conditionally and is not present in this state.",
    ].join(" "),
  },
  "LL-SEMANTIC-INVALID-PATTERN": {
    title: "Invalid regular expression",
    explain: [
      "The pattern supplied to a matches-style rule is not a valid",
      "JavaScript regular expression. The exact engine message is included",
      "in the diagnostic for reference.",
    ].join(" "),
  },
  "LL-SEMANTIC-RULE-INCOMPLETE": {
    title: "Rule missing required slot",
    explain: [
      "The rule is structurally valid but one of its required fields is",
      "empty at evaluation time. For count rules this is the pattern, for",
      "CSS rules it is the property name.",
    ].join(" "),
  },
  "LL-SEMANTIC-INVALID-TARGET": {
    title: "Invalid target size",
    explain: [
      "The size target a rule depends on could not be measured. This often",
      "indicates that the referenced element has zero width or height when",
      "the rule is evaluated.",
    ].join(" "),
  },
  "LL-SEMANTIC-EVALUATION": {
    title: "Rule evaluation failed",
    explain: [
      "The rule failed during evaluation for a reason that does not fit the",
      "more specific categories. The original reason string is preserved as",
      "the diagnostic message.",
    ].join(" "),
  },
};

export function explainCode(code: string): DiagnosticExplanation | undefined {
  return DIAGNOSTIC_CATALOGUE[code];
}
