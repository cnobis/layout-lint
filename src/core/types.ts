export interface Rule {
  element: string;
  negated?: boolean;
  relation: string;
  textExpected?: string;
  textOperations?: Array<"lowercase" | "uppercase" | "singleline">;
  cssProperty?: string;
  cssExpected?: string;
  countPattern?: string;
  countExpected?: number;
  countMin?: number;
  countMax?: number;
  comparator?: "<" | "<=" | ">" | ">=";
  target?: string;
  target2?: string;
  targetProperty?: "width" | "height";
  distancePx?: number;
  distanceMinPx?: number;
  distanceMaxPx?: number;
  distancePct?: number;
  distanceMinPct?: number;
  distanceMaxPct?: number;
  nearDirections?: Array<{
    directions: string[];
    distancePx?: number;
    distanceMinPx?: number;
    distanceMaxPx?: number;
  }>;
  insideOffsets?: Array<{
    sides: string[];
    offsetPx: number;
  }>;
}

export interface RuleResult extends Rule {
  actual: number | string | null;
  pass: boolean;
  reason?: string;
}

export type LayoutLintDiagnosticSeverity = "error" | "warning";

export interface LayoutLintSourcePosition {
  line: number;
  column: number;
}

export interface LayoutLintSourceRange {
  startIndex: number;
  endIndex: number;
  start: LayoutLintSourcePosition;
  end: LayoutLintSourcePosition;
}

export interface LayoutLintDiagnostic {
  code: string;
  severity: LayoutLintDiagnosticSeverity;
  message: string;
  range: LayoutLintSourceRange;
  snippet?: string;
}
