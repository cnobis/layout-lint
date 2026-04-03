import type { LayoutLintMonitorController } from "../../devtools.js";
import type { RuleResult } from "../../core/types.js";
import type { WidgetState } from "./state.js";

export interface RenderRowsDeps {
  body: HTMLDivElement;
  status: HTMLSpanElement;
  state: WidgetState;
  monitor: LayoutLintMonitorController;
  renderActiveHighlight: () => void;
  clampWidgetIntoViewport: () => void;
  scheduleClampWidgetIntoViewport: () => void;
  updatePinStatus: () => void;
}

const isSizeRelation = (relation: string) => relation === "width" || relation === "height";
const isSemanticRelation = (relation: string) => ["inside", "partially-inside"].includes(relation);
const isAlignmentRelation = (relation: string) =>
  relation.startsWith("aligned-") || relation === "centered-x" || relation === "centered-y";
const isEqualGapRelation = (relation: string) => relation === "equal-gap-x" || relation === "equal-gap-y";

const buildHeadline = (item: RuleResult) => {
  const hasPercentDistance = item.distancePct != null || item.distanceMinPct != null || item.distanceMaxPct != null;
  const comparatorPrefix = item.comparator ? `${item.comparator} ` : "";
  const sizeExpected = hasPercentDistance
    ? (item.distancePct != null
        ? `${item.distancePct}%`
        : `${item.distanceMinPct} to ${item.distanceMaxPct}%`)
    : (item.distancePx != null
        ? `${item.distancePx}px`
        : `${item.distanceMinPx} to ${item.distanceMaxPx}px`);

  if (isSizeRelation(item.relation)) {
    const sizeTarget = hasPercentDistance && item.target && item.targetProperty
      ? ` of ${item.target}/${item.targetProperty}`
      : "";
    return `${item.pass ? "✓" : "✗"} ${item.element} ${item.negated ? "not " : ""}${item.relation} ${comparatorPrefix}${sizeExpected}${sizeTarget}`;
  }

  return `${item.pass ? "✓" : "✗"} ${item.element} ${item.negated ? "not " : ""}${item.relation}${item.target ? ` ${item.target}` : ""}${item.target2 ? ` ${item.target2}` : ""}`;
};

const buildMeta = (item: RuleResult) => {
  const hasPercentDistance = item.distancePct != null || item.distanceMinPct != null || item.distanceMaxPct != null;

  if (isSemanticRelation(item.relation)) {
    const label = item.relation === "partially-inside" ? "partially inside" : "inside";
    return item.pass ? `${label}: constraint met` : `${label}: constraint not met`;
  }

  if (isSizeRelation(item.relation)) {
    const unit = hasPercentDistance ? "%" : "px";
    const actualText = typeof item.actual !== "number" ? "n/a" : `${Number(item.actual.toFixed(2))}${unit}`;
    let expectedText = "";
    if (item.comparator && (item.distancePx != null || item.distancePct != null)) {
      expectedText = `${item.comparator} ${item.distancePct ?? item.distancePx}${unit}`;
    } else if (hasPercentDistance) {
      expectedText = item.distancePct != null
        ? `${item.distancePct}%`
        : `${item.distanceMinPct} to ${item.distanceMaxPct}%`;
    } else if (item.distanceMinPx != null && item.distanceMaxPx != null) {
      expectedText = `${item.distanceMinPx} to ${item.distanceMaxPx}px`;
    } else if (item.distancePx != null) {
      expectedText = `${item.distancePx}px`;
    }

    const targetBasis = hasPercentDistance && item.target && item.targetProperty
      ? ` of ${item.target}/${item.targetProperty}`
      : "";

    return `actual ${item.relation}: ${actualText}${expectedText ? ` | expected: ${expectedText}${targetBasis}` : ""}`;
  }

  if (isAlignmentRelation(item.relation)) {
    return `actual offset: ${item.actual ?? "n/a"} | expected: <= 1px`;
  }

  if (isEqualGapRelation(item.relation)) {
    const tolerance = item.distancePx ?? 1;
    return `actual gap delta: ${item.actual ?? "n/a"} | expected: <= ${tolerance}px`;
  }

  return `actual distance: ${item.actual ?? "n/a"}${item.distancePx != null ? ` | expected: >= ${item.distancePx}px` : ""}`;
};

export function renderWidgetRows(results: RuleResult[], deps: RenderRowsDeps) {
  const { body, status, state, monitor, renderActiveHighlight, clampWidgetIntoViewport, scheduleClampWidgetIntoViewport, updatePinStatus } = deps;

  body.innerHTML = "";
  if (results.length === 0) {
    body.textContent = "No rules";
    status.textContent = "0/0";
    scheduleClampWidgetIntoViewport();
    return;
  }

  const passed = results.filter((r) => r.pass).length;
  status.textContent = `${passed}/${results.length}`;

  for (const [index, item] of results.entries()) {
    const row = document.createElement("div");
    const rowKey = state.getRuleKey(item);
    const isPinned = state.isPinned(item);
    const ruleNumber = index + 1;
    row.style.border = "1px solid #e5e7eb";
    row.style.borderRadius = "6px";
    row.style.padding = "6px 8px";
    row.style.marginBottom = "6px";
    row.style.background = item.pass ? "#ecfdf5" : "#fef2f2";
    row.style.cursor = "pointer";
    if (isPinned) {
      row.style.borderColor = "#7a81ff";
      row.style.boxShadow = "0 0 0 1px rgba(122,129,255,0.35)";
    }

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "6px";

    const numberBadge = document.createElement("span");
    numberBadge.style.display = "inline-flex";
    numberBadge.style.alignItems = "center";
    numberBadge.style.justifyContent = "center";
    numberBadge.style.minWidth = "26px";
    numberBadge.style.padding = "1px 7px";
    numberBadge.style.borderRadius = "999px";
    numberBadge.style.fontSize = "10px";
    numberBadge.style.fontWeight = "700";
    numberBadge.style.lineHeight = "1.3";
    numberBadge.style.border = item.pass ? "1px solid #34d399" : "1px solid #f87171";
    numberBadge.style.background = item.pass ? "#d1fae5" : "#fee2e2";
    numberBadge.style.color = item.pass ? "#065f46" : "#991b1b";
    numberBadge.textContent = `${ruleNumber}`;

    const headText = document.createElement("span");
    headText.style.fontWeight = "600";
    headText.style.color = item.pass ? "#065f46" : "#991b1b";
    headText.textContent = buildHeadline(item);

    head.appendChild(numberBadge);
    head.appendChild(headText);

    const meta = document.createElement("div");
    meta.style.fontSize = "11px";
    meta.style.color = "#374151";
    meta.textContent = buildMeta(item);

    const onRowEnter = () => {
      if (state.hasPinnedRules()) return;
      state.setActiveRule(item);
      renderActiveHighlight();
    };

    const onRowLeave = () => {
      if (state.hasPinnedRules()) return;
      state.setActiveRule(null);
      renderActiveHighlight();
    };

    const onRowPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      state.togglePinnedRule(item);
      updatePinStatus();
      renderActiveHighlight();

      requestAnimationFrame(() => {
        monitor.pauseObserver();
        renderWidgetRows(results, deps);
        monitor.resumeObserver();
      });
    };

    row.addEventListener("pointerenter", onRowEnter);
    row.addEventListener("pointerleave", onRowLeave);
    row.addEventListener("pointerdown", onRowPointerDown);

    row.appendChild(head);
    row.appendChild(meta);
    body.appendChild(row);
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.marginTop = "10px";
  buttonContainer.style.paddingTop = "8px";
  buttonContainer.style.borderTop = "1px solid #e5e7eb";

  const evaluateBtn = document.createElement("button");
  evaluateBtn.type = "button";
  evaluateBtn.textContent = "Evaluate";
  evaluateBtn.style.width = "100%";
  evaluateBtn.style.padding = "6px 8px";
  evaluateBtn.style.fontSize = "11px";
  evaluateBtn.style.fontWeight = "600";
  evaluateBtn.style.border = "1px solid #d1d5db";
  evaluateBtn.style.borderRadius = "6px";
  evaluateBtn.style.background = "#f3f4f6";
  evaluateBtn.style.color = "#374151";
  evaluateBtn.style.cursor = "pointer";
  evaluateBtn.style.transition = "all 120ms ease";

  evaluateBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  evaluateBtn.addEventListener("click", () => {
    void monitor.evaluateNow();
  });

  evaluateBtn.addEventListener("pointerenter", () => {
    evaluateBtn.style.background = "#e5e7eb";
    evaluateBtn.style.borderColor = "#9ca3af";
  });

  evaluateBtn.addEventListener("pointerleave", () => {
    evaluateBtn.style.background = "#f3f4f6";
    evaluateBtn.style.borderColor = "#d1d5db";
  });

  buttonContainer.appendChild(evaluateBtn);
  body.appendChild(buttonContainer);
  scheduleClampWidgetIntoViewport();
}
