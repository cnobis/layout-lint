import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { RuleResult } from "../../core/types.js";
import type { WidgetCategory } from "./types.js";
import type { WidgetState } from "./state.js";
import { renderFooterStatusBar, styleFooterStatusBar } from "./footer-status.js";

export interface RenderRowsDeps {
  body: HTMLDivElement;
  status: HTMLSpanElement;
  state: WidgetState;
  monitor: LayoutLintMonitorController;
  renderActiveHighlight: () => void;
  scheduleClampWidgetIntoViewport: () => void;
  requestRerender: () => void;
  onUnpinAll: () => void;
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

const createPinIcon = (size = 14) => {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("width", `${size}`);
  svg.setAttribute("height", `${size}`);
  svg.setAttribute("aria-hidden", "true");

  const stem = document.createElementNS(svgNS, "path");
  stem.setAttribute("d", "M12 17v5");

  const body = document.createElementNS(svgNS, "path");
  body.setAttribute(
    "d",
    "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
  );

  svg.appendChild(stem);
  svg.appendChild(body);
  return svg;
};

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
  const { body, status, state, monitor, renderActiveHighlight, scheduleClampWidgetIntoViewport, requestRerender } = deps;

  const existingScroll = body.querySelector("[data-widget-constraints-scroll='true']") as HTMLDivElement | null;
  const previousScrollTop = existingScroll?.scrollTop ?? 0;

  body.innerHTML = "";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.overflow = "hidden";
  body.style.minHeight = "0";
  body.style.paddingBottom = "0";
  if (results.length === 0) {
    body.textContent = "No rules";
    styleFooterStatusBar(status);
    renderFooterStatusBar(status, 0, 0);
    scheduleClampWidgetIntoViewport();
    return;
  }

  const passed = results.filter((r) => r.pass).length;

  const viewModel = state.getViewModel(results);
  const hasMultiplePages = viewModel.settings.tabsEnabled && viewModel.totalPages > 1;

  // Tab container with count integrated
  const tabContainer = document.createElement("div");
  tabContainer.style.marginBottom = "4px";

  const categoryTabsRow = document.createElement("div");
  categoryTabsRow.style.display = "flex";
  categoryTabsRow.style.alignItems = "center";
  categoryTabsRow.style.gap = "0";
  categoryTabsRow.style.borderBottom = "1px solid #e5e7eb";

  const createCategoryTab = (category: WidgetCategory, count: number) => {
    const button = document.createElement("button");
    button.type = "button";
    const selected = viewModel.category === category;
    button.style.flex = "1";
    button.style.padding = "6px 10px 5px";
    button.style.borderRadius = "0";
    button.style.fontWeight = "600";
    button.style.border = "none";
    button.style.borderBottom = selected ? "2px solid #6366f1" : "2px solid transparent";
    button.style.background = selected ? "#f9fafb" : "#ffffff";
    button.style.color = selected ? "#1f2937" : "#6b7280";
    button.style.cursor = "pointer";
    button.style.outline = "none";
    button.style.transition = "all 120ms ease";
    button.style.display = "flex";
    button.style.flexDirection = "column";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.gap = "1px";
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => {
      state.setActiveCategory(category);
      requestRerender();
    });
    button.addEventListener("focus", () => {
      button.style.background = "#f3f4f6";
    });
    button.addEventListener("blur", () => {
      button.style.background = selected ? "#f9fafb" : "#ffffff";
    });

    const label = document.createElement("span");
    label.textContent = CATEGORY_LABELS[category];
    label.style.fontSize = "11px";
    label.style.lineHeight = "1.1";

    const amount = document.createElement("span");
    amount.textContent = `(${count})`;
    amount.style.fontSize = "10px";
    amount.style.lineHeight = "1.1";
    amount.style.fontWeight = "700";
    amount.style.color = selected ? "#4338ca" : "#9ca3af";

    button.appendChild(label);
    button.appendChild(amount);
    return button;
  };

  categoryTabsRow.appendChild(createCategoryTab("all", viewModel.counts.all));
  categoryTabsRow.appendChild(createCategoryTab("failing", viewModel.counts.failing));
  categoryTabsRow.appendChild(createCategoryTab("passing", viewModel.counts.passing));

  tabContainer.appendChild(categoryTabsRow);
  body.appendChild(tabContainer);

  const categoryTabs = categoryTabsRow;

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

  const constraintsScroll = document.createElement("div");
  constraintsScroll.dataset.widgetConstraintsScroll = "true";
  constraintsScroll.style.flex = "1 1 auto";
  constraintsScroll.style.minHeight = "0";
  constraintsScroll.style.overflowY = "auto";
  constraintsScroll.style.overflowX = "hidden";
  constraintsScroll.style.paddingRight = "2px";
  constraintsScroll.style.paddingBottom = "2px";
  body.appendChild(constraintsScroll);

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
      renderActiveHighlight();
      requestRerender();
    };

    row.addEventListener("pointerenter", onRowEnter);
    row.addEventListener("pointerleave", onRowLeave);
    row.addEventListener("pointerdown", onRowPointerDown);

    row.appendChild(head);
    row.appendChild(meta);
    constraintsScroll.appendChild(row);
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "relative";
  buttonContainer.style.flex = "0 0 auto";
  buttonContainer.style.marginLeft = "-10px";
  buttonContainer.style.marginRight = "-10px";
  buttonContainer.style.marginBottom = "0";
  buttonContainer.style.paddingLeft = "0";
  buttonContainer.style.paddingRight = "0";
  buttonContainer.style.paddingTop = "8px";
  buttonContainer.style.paddingBottom = "0";
  buttonContainer.style.borderTop = "1px solid #e5e7eb";
  buttonContainer.style.background = "white";
  buttonContainer.style.boxShadow = "none";
  buttonContainer.style.zIndex = "10";
  buttonContainer.style.overflow = "hidden";

  styleFooterStatusBar(status);

  const footerRow = document.createElement("div");
  footerRow.style.display = "grid";
  footerRow.style.gridTemplateColumns = "minmax(0, 1fr) auto";
  footerRow.style.alignItems = "center";
  footerRow.style.columnGap = "8px";
  footerRow.style.paddingLeft = "10px";
  footerRow.style.paddingRight = "10px";
  footerRow.style.paddingBottom = "0";
  footerRow.style.background = "white";

  const refreshWrap = document.createElement("div");
  refreshWrap.style.display = "flex";
  refreshWrap.style.alignItems = "center";
  refreshWrap.style.width = "100%";

  const footerActions = document.createElement("div");
  footerActions.style.display = "flex";
  footerActions.style.alignItems = "center";
  footerActions.style.justifyContent = "flex-end";
  footerActions.style.gap = "0";
  footerActions.style.fontSize = "11px";
  footerActions.style.width = "100%";

  const actionButtons = document.createElement("div");
  actionButtons.style.display = "flex";
  actionButtons.style.alignItems = "center";
  actionButtons.style.gap = "0";

  const pinnedCount = state.getPinnedRuleCount();
  const hasPinnedRules = pinnedCount > 0;

  const pinControlContainer = document.createElement("div");
  pinControlContainer.style.display = "flex";
  pinControlContainer.style.alignItems = "center";
  pinControlContainer.style.gap = "0";
  pinControlContainer.style.border = "1px solid #d1d5db";
  pinControlContainer.style.borderRadius = "6px";
  pinControlContainer.style.background = "#f3f4f6";
  pinControlContainer.style.overflow = "hidden";

  const statusSide = document.createElement("div");
  statusSide.style.display = "flex";
  statusSide.style.alignItems = "center";
  statusSide.style.gap = "4px";
  statusSide.style.padding = "6px 8px";
  statusSide.style.color = hasPinnedRules ? "#1f2937" : "#6b7280";
  statusSide.style.cursor = "default";
  statusSide.style.userSelect = "none";
  statusSide.title = `${pinnedCount} pinned constraint${pinnedCount !== 1 ? 's' : ''}`;
  statusSide.appendChild(createPinIcon(12));
  const pinnedCountText = document.createElement("span");
  pinnedCountText.textContent = `${pinnedCount}`;
  pinnedCountText.style.minWidth = "1ch";
  pinnedCountText.style.fontSize = "11px";
  pinnedCountText.style.fontWeight = "600";
  statusSide.appendChild(pinnedCountText);

  const divider = document.createElement("div");
  divider.style.width = "1px";
  divider.style.height = "20px";
  divider.style.background = "#d1d5db";
  divider.style.opacity = "0.3";

  const unpinBtn = document.createElement("button");
  unpinBtn.type = "button";
  unpinBtn.textContent = "Unpin All";
  unpinBtn.style.display = "flex";
  unpinBtn.style.alignItems = "center";
  unpinBtn.style.justifyContent = "center";
  unpinBtn.style.padding = "6px 8px";
  unpinBtn.style.fontSize = "11px";
  unpinBtn.style.fontWeight = "600";
  unpinBtn.style.border = "none";
  unpinBtn.style.background = "transparent";
  unpinBtn.style.color = "#374151";
  unpinBtn.style.cursor = hasPinnedRules ? "pointer" : "not-allowed";
  unpinBtn.style.outline = "none";
  unpinBtn.style.transition = "all 120ms ease";
  unpinBtn.disabled = !hasPinnedRules;
  unpinBtn.style.opacity = hasPinnedRules ? "1" : "0.55";

  pinControlContainer.appendChild(statusSide);
  pinControlContainer.appendChild(divider);
  pinControlContainer.appendChild(unpinBtn);

  unpinBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  unpinBtn.addEventListener("click", () => {
    if (!state.hasPinnedRules()) return;
    deps.onUnpinAll();
  });
  unpinBtn.addEventListener("focus", () => {
    pinControlContainer.style.borderColor = "#6366f1";
    pinControlContainer.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
  });
  unpinBtn.addEventListener("blur", () => {
    pinControlContainer.style.borderColor = "#d1d5db";
    pinControlContainer.style.boxShadow = "none";
  });
  unpinBtn.addEventListener("pointerenter", () => {
    if (!hasPinnedRules) return;
    unpinBtn.style.background = "#e5e7eb";
  });
  unpinBtn.addEventListener("pointerleave", () => {
    unpinBtn.style.background = "transparent";
  });

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

  renderFooterStatusBar(status, passed, results.length);
  status.style.marginTop = "6px";
  status.style.marginLeft = "0";
  status.style.marginRight = "0";
  status.style.marginBottom = "0";

  refreshWrap.appendChild(evaluateBtn);
  actionButtons.appendChild(pinControlContainer);
  footerRow.appendChild(refreshWrap);
  footerRow.appendChild(actionButtons);
  buttonContainer.appendChild(footerRow);
  buttonContainer.appendChild(status);
  body.appendChild(buttonContainer);

  constraintsScroll.scrollTop = previousScrollTop;
  scheduleClampWidgetIntoViewport();
}
