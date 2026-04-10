// @ts-expect-error no types for this local js
import type { Parser, Language, Tree, Query } from "../../../demo/web-tree-sitter.js";
import { getParser, getLanguage } from "../../core/parser.js";
import { HIGHLIGHTS_SCM } from "./highlight-query.js";

/** CSS class for each capture name produced by highlights.scm */
export const CAPTURE_CLASS: Record<string, string> = {
  comment: "token comment",
  keyword: "token keyword",
  number: "token number",
  unit: "token unit",
  variable: "token variable",
  string: "token string",
  operator: "token operator",
  property: "token property",
  punctuation: "token punctuation",
  error: "token error",
};

export interface HighlightToken {
  text: string;
  className?: string;
}

export interface Highlighter {
  /** Tokenize the full text, reusing the previous tree for incremental parsing. */
  tokenize(text: string): HighlightToken[];
  destroy(): void;
}

/**
 * Initialise a tree-sitter-backed highlighter.
 * Returns null if WASM loading fails so the caller can fall back to the naive highlighter.
 */
export async function initHighlighter(
  wasmUrl: string,
  locateFile?: (path: string) => string,
): Promise<Highlighter | null> {
  try {
    const [parser, language] = await Promise.all([
      getParser(wasmUrl, locateFile),
      getLanguage(wasmUrl, locateFile),
    ]);

    const query: Query = language.query(HIGHLIGHTS_SCM);
    let previousTree: Tree | null = null;
    let previousText = "";

    const tokenize = (text: string): HighlightToken[] => {
      let tree: Tree;

      if (previousTree && previousText !== text) {
        // Compute the minimal edit region for incremental parsing.
        const changeStart = findFirstDiff(previousText, text);
        const oldEnd = previousText.length;
        const newEnd = text.length;

        previousTree.edit({
          startIndex: changeStart,
          oldEndIndex: oldEnd,
          newEndIndex: newEnd,
          startPosition: indexToPoint(previousText, changeStart),
          oldEndPosition: indexToPoint(previousText, oldEnd),
          newEndPosition: indexToPoint(text, newEnd),
        });
        tree = parser.parse(text, previousTree);
      } else {
        tree = parser.parse(text);
      }

      previousTree = tree;
      previousText = text;

      // Collect captures sorted by start position.
      const captures = query.captures(tree.rootNode);
      const tokens: HighlightToken[] = [];
      let cursor = 0;

      for (const capture of captures) {
        const { node } = capture;
        const start = node.startIndex;
        const end = node.endIndex;

        // Skip overlapping captures (first match wins)
        if (start < cursor) continue;

        // Gap before this capture → plain text
        if (start > cursor) {
          tokens.push({ text: text.slice(cursor, start) });
        }

        const cls = CAPTURE_CLASS[capture.name];
        tokens.push({ text: text.slice(start, end), className: cls });
        cursor = end;
      }

      // Trailing text after last capture
      if (cursor < text.length) {
        tokens.push({ text: text.slice(cursor) });
      }

      return tokens;
    };

    const destroy = () => {
      if (previousTree) {
        previousTree.delete();
        previousTree = null;
      }
      query.delete();
    };

    return { tokenize, destroy };
  } catch {
    return null;
  }
}

// ── Helpers (exported for testing) ────────────────────────────────────

export function findFirstDiff(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len;
}

export function indexToPoint(text: string, index: number): { row: number; column: number } {
  let row = 0;
  let lastNewline = -1;
  for (let i = 0; i < index; i++) {
    if (text[i] === "\n") {
      row++;
      lastNewline = i;
    }
  }
  return { row, column: index - lastNewline - 1 };
}
