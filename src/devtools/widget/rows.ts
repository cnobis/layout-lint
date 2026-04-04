import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { RuleResult } from "../../core/types.js";
import type { WidgetCategory } from "./types.js";
import type { WidgetState } from "./state.js";

export interface RenderRowsDeps {
  body: HTMLDivElement;
  status: HTMLSpanElement;
  state: WidgetState;
  monitor: LayoutLintMonitorController;
  renderActiveHighlight: () => void;
  scheduleClampWidgetIntoViewport: () => void;
  updatePinStatus: () => void;
  requestRerender: () => void;
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  all: "All",
  failing: "Failing",
  passing: "Passing",
};

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
  const { body, status, state, monitor, renderActiveHighlight, scheduleClampWidgetIntoViewport, updatePinStatus, requestRerender } = deps;

  body.innerHTML = "";
  if (results.length === 0) {
    body.textContent = "No rules";
    status.textContent = "0/0";
    scheduleClampWidgetIntoViewport();
    return;
  }

  const passed = results.filter((r) => r.pass).length;
  status.textContent = `${passed}/${results.length}`;

  const viewModel = state.getViewModel(results);
  const hasMultiplePages = viewModel.settings.tabsEnabled && viewModel.totalPages > 1;

  const categoryTabs = document.createElement("div");
  categoryTabs.style.display = "flex";
  categoryTabs.style.gap = "6px";
  categoryTabs.style.marginBottom = "8px";

  const createCategoryTab = (category: WidgetCategory, count: number) => {
    const button = document.createElement("button");
    button.type = "button";
    const selected = viewModel.category === category;
    button.textContent = `${CATEGORY_LABELS[category]} (${count})`;
    button.style.padding = "3px 8px";
    button.style.borderRadius = "999px";
    button.style.fontSize = "10px";
    button.style.fontWeight = "600";
    button.style.border = selected ? "1px solid #6366f1" : "1px solid #d1d5db";
    button.style.background = selected ? "#eef2ff" : "#ffffff";
    button.style.color = selected ? "#3730a3" : "#4b5563";
    button.style.cursor = "pointer";
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => {
      state.setActiveCategory(category);
      requestRerender();
    });
    return button;
  };

  categoryTabs.appendChild(createCategoryTab("all", viewModel.counts.all));
  categoryTabs.appendChild(createCategoryTab("failing", viewModel.counts.failing));
  categoryTabs.appendChild(createCategoryTab("passing", viewModel.counts.passing));
  body.appendChild(categoryTabs);

  if (hasMultiplePages) {
    const pageTabs = document.createElement("div");
    pageTabs.style.display = "flex";
    pageTabs.style.flexWrap = "wrap";
    pageTabs.style.gap = "4px";
    pageTabs.style.marginBottom = "8px";

    for (let page = 1; page <= viewModel.totalPages; page += 1) {
      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.textContent = `${page}`;
      pageButton.style.minWidth = "24px";
      pageButton.style.padding = "2px 6px";
      pageButton.style.borderRadius = "999px";
      pageButton.style.fontSize = "10px";
      pageButton.style.fontWeight = "600";
      pageButton.style.border = page === viewModel.page ? "1px solid #7a81ff" : "1px solid #d1d5db";
      pageButton.style.background = page === viewModel.page ? "#e0e7ff" : "#ffffff";
      pageButton.style.color = page === viewModel.page ? "#3730a3" : "#4b5563";
      pageButton.style.cursor = "pointer";
      pageButton.addEventListener("pointerdown", (event) => event.stopPropagation());
      pageButton.addEventListener("click", () => {
        state.setActivePage(page);
        requestRerender();
      });
      pageTabs.appendChild(pageButton);
    }

    body.appendChild(pageTabs);
  }

  for (const [index, item] of viewModel.visibleResults.entries()) {
    const row = document.createElement("div");
    const isPinned = state.isPinned(item);
    const byReferenceIndex = results.findIndex((candidate) => candidate === item);
    const globalIndex = byReferenceIndex >= 0
      ? byReferenceIndex
      : results.findIndex((candidate) => state.getRuleKey(candidate) === state.getRuleKey(item));
    const ruleNumber = globalIndex >= 0 ? globalIndex + 1 : index + 1;
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
      requestRerender();
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
  evaluateBtn.textContent = "Refresh Results";
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
  evaluateBtn.style.outline = "none";

  evaluateBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  evaluateBtn.addEventListener("click", () => {
    void monitor.evaluateNow();
  });
  evaluateBtn.addEventListener("focus", () => {
    evaluateBtn.style.borderColor = "#6366f1";
    evaluateBtn.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
  });
  evaluateBtn.addEventListener("blur", () => {
    evaluateBtn.style.borderColor = "#d1d5db";
    evaluateBtn.style.boxShadow = "none";
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
