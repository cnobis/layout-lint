import type {
  LayoutLintDiagnostic,
  LayoutLintSecondarySpan,
  LayoutLintSourceRange,
} from "./types.js";
import { explainCode } from "./diagnostic-codes.js";

export interface FormatDiagnosticOptions {
  color?: boolean;
  contextLines?: number;
  includeExplain?: boolean;
}

const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const CYAN = "\u001b[36m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

function wrap(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${RESET}` : text;
}

function severityColor(severity: LayoutLintDiagnostic["severity"]): string {
  return severity === "warning" ? YELLOW : RED;
}

function severityLabel(severity: LayoutLintDiagnostic["severity"]): string {
  return severity === "warning" ? "warning" : "error";
}

interface UnderlineSpec {
  range: LayoutLintSourceRange;
  label?: string;
  marker: string;
  color: string;
}

function lineEndIndex(source: string, lineStart: number): number {
  const nl = source.indexOf("\n", lineStart);
  return nl === -1 ? source.length : nl;
}

function findLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function renderUnderlineRow(
  lineText: string,
  lineStartIndex: number,
  underlines: UnderlineSpec[],
  gutterWidth: number,
  color: boolean,
): string[] {
  const lineLength = lineText.length;
  const lineEnd = lineStartIndex + lineLength;
  const slots: { marker: string; color: string }[] = Array(lineLength).fill(null);

  for (const u of underlines) {
    const startInLine = Math.max(0, u.range.startIndex - lineStartIndex);
    const endInLine = Math.min(lineLength, u.range.endIndex - lineStartIndex);
    if (endInLine <= 0 || startInLine >= lineLength) continue;
    const len = Math.max(1, endInLine - startInLine);
    for (let i = 0; i < len; i += 1) {
      const pos = startInLine + i;
      if (pos < 0 || pos >= lineLength) continue;
      const existing = slots[pos];
      if (!existing || u.marker === "^") {
        slots[pos] = { marker: u.marker, color: u.color };
      }
    }
  }

  // assemble underline row
  let underline = "";
  let i = 0;
  while (i < lineLength) {
    const slot = slots[i];
    if (!slot) {
      underline += " ";
      i += 1;
    } else {
      let run = "";
      const slotColor = slot.color;
      while (i < lineLength && slots[i] && slots[i].color === slotColor) {
        run += slots[i].marker;
        i += 1;
      }
      underline += wrap(run, slotColor, color);
    }
  }

  // pick label for this line: prefer the primary span (marker "^") that starts on this line
  let label: string | undefined;
  let labelColor = "";
  let labelOffset = 0;
  for (const u of underlines) {
    if (u.range.startIndex < lineStartIndex || u.range.startIndex >= lineEnd) continue;
    if (!u.label) continue;
    if (label === undefined || u.marker === "^") {
      label = u.label;
      labelColor = u.color;
      labelOffset = Math.max(0, u.range.startIndex - lineStartIndex);
      if (u.marker === "^") break;
    }
  }

  const gutterPad = " ".repeat(gutterWidth);
  const rows: string[] = [`${gutterPad} | ${underline.trimEnd()}`];
  if (label !== undefined) {
    const pad = " ".repeat(labelOffset);
    rows.push(`${gutterPad} | ${pad}${wrap(label, labelColor, color)}`);
  }
  return rows;
}

export function formatDiagnostic(
  diagnostic: LayoutLintDiagnostic,
  source: string,
  options: FormatDiagnosticOptions = {},
): string {
  const { color = false, contextLines = 0, includeExplain = false } = options;

  const lineStarts = findLineStarts(source);
  const totalLines = lineStarts.length;

  const headerColor = severityColor(diagnostic.severity);
  const headerLabel = severityLabel(diagnostic.severity);
  const header = `${wrap(`${headerLabel}[${diagnostic.code}]`, headerColor, color)}: ${diagnostic.message}`;

  const primary = diagnostic.range;
  const locator = `${wrap("-->", CYAN, color)} <spec>:${primary.start.line}:${primary.start.column + 1}`;

  const underlines: UnderlineSpec[] = [];
  underlines.push({
    range: primary,
    label: diagnostic.primaryLabel,
    marker: "^",
    color: headerColor,
  });
  for (const span of diagnostic.secondarySpans ?? []) {
    underlines.push({ range: span.range, label: span.label, marker: "-", color: CYAN });
  }

  // gather all touched line numbers (1-based) with context
  const touched = new Set<number>();
  for (const u of underlines) {
    const startLine = Math.max(1, u.range.start.line - contextLines);
    const endLine = Math.min(totalLines, u.range.end.line + contextLines);
    for (let l = startLine; l <= endLine; l += 1) touched.add(l);
  }

  const sortedLines = [...touched].sort((a, b) => a - b);
  const gutterWidth = String(sortedLines[sortedLines.length - 1] ?? 1).length;

  const lines: string[] = [];
  lines.push(header);
  lines.push(`${" ".repeat(gutterWidth)} ${locator}`);
  lines.push(`${" ".repeat(gutterWidth)} |`);

  let prevLineNumber = -1;
  for (const lineNumber of sortedLines) {
    if (prevLineNumber !== -1 && lineNumber !== prevLineNumber + 1) {
      lines.push(`${" ".repeat(gutterWidth)} ...`);
    }
    const lineStart = lineStarts[lineNumber - 1];
    const lineEnd = lineEndIndex(source, lineStart);
    const lineText = source.slice(lineStart, lineEnd);
    const gutter = String(lineNumber).padStart(gutterWidth, " ");
    lines.push(`${gutter} | ${lineText}`);
    const lineHasUnderline = underlines.some(
      (u) => u.range.startIndex < lineEnd && u.range.endIndex > lineStart,
    );
    if (lineHasUnderline) {
      lines.push(...renderUnderlineRow(lineText, lineStart, underlines, gutterWidth, color));
    }
    prevLineNumber = lineNumber;
  }

  if (diagnostic.hint) {
    lines.push(`${" ".repeat(gutterWidth)} ${wrap("=", CYAN, color)} ${wrap("hint", CYAN, color)}: ${diagnostic.hint}`);
  } else if (diagnostic.suggestion) {
    lines.push(`${" ".repeat(gutterWidth)} ${wrap("=", CYAN, color)} ${wrap("hint", CYAN, color)}: did you mean \`${diagnostic.suggestion}\`?`);
  }

  if (diagnostic.fix) {
    const desc = diagnostic.fix.description ?? `replace with \`${diagnostic.fix.replacement}\``;
    lines.push(`${" ".repeat(gutterWidth)} ${wrap("=", CYAN, color)} ${wrap("fix", CYAN, color)}: ${desc}`);
  }

  if (includeExplain) {
    const explanation = explainCode(diagnostic.code);
    if (explanation) {
      lines.push("");
      lines.push(wrap(`= ${explanation.title}`, DIM, color));
      lines.push(wrap(`  ${explanation.explain}`, DIM, color));
    }
  }

  return lines.join("\n");
}
