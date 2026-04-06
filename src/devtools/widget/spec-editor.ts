// Toggle this constant to switch editor implementations for development/testing
const USE_HIGHLIGHTED_EDITOR = true;
import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { FooterDiagnosticsSummary, FooterStatusMode } from "./footer-status.js";
import type { LayoutLintDiagnostic } from "../../core/types.js";
import { createFooterStatusContainer, renderFooterStatusBar, styleFooterStatusBar } from "./footer-status.js";
import { HighlightedEditorView } from "./highlighted-editor-view.js";
import type { EditorView } from "./editor-view.js";
import { PlainTextareaEditorView } from "./editor-view.js";

interface RenderSpecEditorPanelArgs {
  body: HTMLDivElement;
  status: HTMLSpanElement;
  footerStatusMode: FooterStatusMode;
  footerStatusActionLabel: string;
  footerDiagnosticsSummary: FooterDiagnosticsSummary;
  footerPassedCount: number;
  footerTotalCount: number;
  editorBackground: string;
  scheduleClampWidgetIntoViewport: () => void;
}

interface CreateSpecEditorArgs {
  monitor: LayoutLintMonitorController;
  isStatusTransitionDelayEnabled: () => boolean;
  fakeLoadingDurationMs: number;
  specUpdateStatusLabel: string;
  clearFooterStatusResetTimer: () => void;
  setFooterStatusActionLabel: (label: string) => void;
  setFooterStatusMode: (mode: FooterStatusMode) => void;
  flashFooterStatusDone: () => void;
  showFooterErrorAndReset: () => void;
  requestRerender: () => void;
  updateHeaderToggleStyles: () => void;
}

export interface SpecEditorController {
  isOpen(): boolean;
  open(): void;
  close(): void;
  cancel(): void;
  apply(): Promise<void>;
  renderPanel(args: RenderSpecEditorPanelArgs): void;
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function createSpecEditor(args: CreateSpecEditorArgs): SpecEditorController {
  let isOpen = false;
  let draft = args.monitor.getSpecText();
  let error: string | null = null;
  let diagnostics: LayoutLintDiagnostic[] = [];
  let closeAfterSuccessTimer: number | null = null;
  const expandedRelatedDiagnosticKeys = new Set<string>();

  const clearCloseAfterSuccessTimer = () => {
    if (closeAfterSuccessTimer == null) return;
    window.clearTimeout(closeAfterSuccessTimer);
    closeAfterSuccessTimer = null;
  };

  const formatDiagnostic = (diagnostic: LayoutLintDiagnostic) => {
    const location = `L${diagnostic.range.start.line}:${diagnostic.range.start.column + 1}`;
    const suggestion = diagnostic.suggestion ? ` Did you mean \"${diagnostic.suggestion}\"?` : "";
    return `${diagnostic.code} ${location} - ${diagnostic.message}${suggestion}`;
  };

  const diagnosticKey = (diagnostic: LayoutLintDiagnostic) =>
    `${diagnostic.code}:${diagnostic.range.startIndex}:${diagnostic.range.endIndex}`;

  const close = () => {
    clearCloseAfterSuccessTimer();
    isOpen = false;
    error = null;
    diagnostics = [];
    expandedRelatedDiagnosticKeys.clear();
    args.updateHeaderToggleStyles();
  };

  const open = () => {
    isOpen = true;
    draft = args.monitor.getSpecText();
    error = null;
    diagnostics = [];
    expandedRelatedDiagnosticKeys.clear();
    args.updateHeaderToggleStyles();
  };

  const cancel = () => {
    draft = args.monitor.getSpecText();
    close();
    args.requestRerender();
  };

  const apply = async () => {
    const nextSpec = draft;
    if (!nextSpec.trim()) {
      error = "Spec cannot be empty.";
      diagnostics = [];
      args.requestRerender();
      return;
    }

    const previousSpec = args.monitor.getSpecText();
    if (nextSpec === previousSpec) {
      close();
      args.requestRerender();
      return;
    }

    try {
      args.clearFooterStatusResetTimer();
      clearCloseAfterSuccessTimer();
      args.setFooterStatusActionLabel(args.specUpdateStatusLabel);
      isOpen = true;
      args.updateHeaderToggleStyles();
      args.setFooterStatusMode("loading");
      if (args.isStatusTransitionDelayEnabled()) {
        await delay(args.fakeLoadingDurationMs);
      }
      args.monitor.setSpecText(nextSpec);
      const result = await args.monitor.evaluateNow();
      const errorDiagnostics = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.severity === "error");
      if (errorDiagnostics.length > 0) {
        args.monitor.setSpecText(previousSpec);
        try {
          await args.monitor.evaluateNow();
        } catch {
          // keep prior spec restoration best effort
        }
        diagnostics = errorDiagnostics;
        expandedRelatedDiagnosticKeys.clear();
        error = `Spec contains ${errorDiagnostics.length} syntax issue${errorDiagnostics.length === 1 ? "" : "s"}.`;
        isOpen = true;
        args.updateHeaderToggleStyles();
        args.showFooterErrorAndReset();
        args.requestRerender();
        return;
      }
      diagnostics = [];
      expandedRelatedDiagnosticKeys.clear();
      args.flashFooterStatusDone();
      closeAfterSuccessTimer = window.setTimeout(() => {
        close();
        args.requestRerender();
      }, 220);
    } catch (cause) {
      args.monitor.setSpecText(previousSpec);
      try {
        await args.monitor.evaluateNow();
      } catch {
        // keep prior spec restoration best effort
      }
      error = cause instanceof Error ? cause.message : "Failed to apply spec.";
      diagnostics = [];
      expandedRelatedDiagnosticKeys.clear();
      isOpen = true;
      args.updateHeaderToggleStyles();
      args.showFooterErrorAndReset();
      args.requestRerender();
    }
  };

  const renderPanel = ({
    body,
    status,
    footerStatusMode,
    footerStatusActionLabel,
    footerDiagnosticsSummary,
    footerPassedCount,
    footerTotalCount,
    editorBackground,
    scheduleClampWidgetIntoViewport,
  }: RenderSpecEditorPanelArgs) => {
    body.innerHTML = "";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.overflow = "hidden";
    body.style.minHeight = "0";
    body.style.padding = "8px 10px";
    body.style.paddingBottom = "0";

    const section = document.createElement("div");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.flex = "1 1 auto";
    section.style.minHeight = "0";
    section.style.overflow = "hidden";
    section.style.gap = "8px";
    section.style.padding = "10px";
    section.style.border = "1px solid #dbe3ff";
    section.style.borderRadius = "10px";
    section.style.background = "linear-gradient(180deg, #f8faff 0%, #eef2ff 100%)";

    const heading = document.createElement("div");
    heading.textContent = "Edit Layout Specification";
    heading.style.fontSize = "9px";
    heading.style.fontWeight = "700";
    heading.style.textTransform = "uppercase";
    heading.style.letterSpacing = "0.06em";
    heading.style.color = "#1f2937";
    heading.style.padding = "4px 2px 0";
    heading.style.flex = "0 0 auto";

    const helper = document.createElement("div");
    helper.textContent = "Apply with Cmd/Ctrl+Enter.";
    helper.style.fontSize = "10px";
    helper.style.color = "#6b7280";
    helper.style.flex = "0 0 auto";

    const editorView: EditorView = USE_HIGHLIGHTED_EDITOR
      ? new HighlightedEditorView(draft)
      : new PlainTextareaEditorView(draft, { rows: 12 });
    editorView.setBackground(editorBackground);
    const editorEl = editorView.getElement();
    editorEl.addEventListener("pointerdown", (event: PointerEvent) => event.stopPropagation());
    editorView.onChange((value: string) => {
      draft = value;
      error = null;
      diagnostics = [];
    });
    editorEl.addEventListener("keydown", (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void apply();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "space-between";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";
    actions.style.flex = "0 0 auto";

    const errorText = document.createElement("span");
    errorText.style.fontSize = "10px";
    errorText.style.color = "#b91c1c";
    errorText.textContent = error ?? "";

    const diagnosticsList = document.createElement("div");
    diagnosticsList.style.display = diagnostics.length > 0 ? "grid" : "none";
    diagnosticsList.style.gap = "2px";
    diagnosticsList.style.fontSize = "10px";
    diagnosticsList.style.color = "#7f1d1d";
    diagnosticsList.style.maxHeight = "76px";
    diagnosticsList.style.overflow = "auto";
    diagnosticsList.style.padding = diagnostics.length > 0 ? "2px 0 0" : "0";

    for (const diagnostic of diagnostics.slice(0, 4)) {
      const item = document.createElement("div");
      item.style.display = "grid";
      item.style.gap = "2px";

      const summary = document.createElement("div");
      summary.textContent = formatDiagnostic(diagnostic);
      item.appendChild(summary);

      const related = diagnostic.relatedDiagnostics ?? [];
      if (related.length > 0) {
        const key = diagnosticKey(diagnostic);
        const expanded = expandedRelatedDiagnosticKeys.has(key);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = expanded
          ? `Hide ${related.length} related recover${related.length === 1 ? "y" : "ies"}`
          : `Show ${related.length} related recover${related.length === 1 ? "y" : "ies"}`;
        toggle.style.fontSize = "10px";
        toggle.style.fontWeight = "600";
        toggle.style.color = "#7c2d12";
        toggle.style.background = "transparent";
        toggle.style.border = "none";
        toggle.style.padding = "0";
        toggle.style.width = "fit-content";
        toggle.style.cursor = "pointer";
        toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
        toggle.addEventListener("click", () => {
          if (expandedRelatedDiagnosticKeys.has(key)) {
            expandedRelatedDiagnosticKeys.delete(key);
          } else {
            expandedRelatedDiagnosticKeys.add(key);
          }
          args.requestRerender();
        });
        item.appendChild(toggle);

        if (expanded) {
          const relatedList = document.createElement("div");
          relatedList.style.display = "grid";
          relatedList.style.gap = "1px";
          relatedList.style.paddingLeft = "10px";
          relatedList.style.color = "#9a3412";

          for (const relatedDiagnostic of related) {
            const relatedLocation = `L${relatedDiagnostic.range.start.line}:${relatedDiagnostic.range.start.column + 1}`;
            const relatedSuggestion = relatedDiagnostic.suggestion
              ? ` Did you mean \"${relatedDiagnostic.suggestion}\"?`
              : "";
            const relatedLine = document.createElement("div");
            relatedLine.textContent = `- ${relatedDiagnostic.code} ${relatedLocation} - ${relatedDiagnostic.message}${relatedSuggestion}`;
            relatedList.appendChild(relatedLine);
          }

          item.appendChild(relatedList);
        }
      }

      diagnosticsList.appendChild(item);
    }

    if (diagnostics.length > 4) {
      const overflow = document.createElement("div");
      overflow.textContent = `...and ${diagnostics.length - 4} more`;
      diagnosticsList.appendChild(overflow);
    }

    const actionButtons = document.createElement("div");
    actionButtons.style.display = "flex";
    actionButtons.style.gap = "6px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.padding = "6px 8px";
    cancelButton.style.fontSize = "11px";
    cancelButton.style.fontWeight = "600";
    cancelButton.style.border = "1px solid #d1d5db";
    cancelButton.style.borderRadius = "6px";
    cancelButton.style.background = "#f3f4f6";
    cancelButton.style.color = "#374151";
    cancelButton.style.cursor = "pointer";
    cancelButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    cancelButton.addEventListener("click", () => {
      cancel();
    });

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "Apply";
    applyButton.style.padding = "6px 10px";
    applyButton.style.fontSize = "11px";
    applyButton.style.fontWeight = "700";
    applyButton.style.border = "1px solid #6366f1";
    applyButton.style.borderRadius = "6px";
    applyButton.style.background = "#e0e7ff";
    applyButton.style.color = "#3730a3";
    applyButton.style.cursor = "pointer";
    applyButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    applyButton.addEventListener("click", () => {
      void apply();
    });

    actionButtons.appendChild(cancelButton);
    actionButtons.appendChild(applyButton);
    actions.appendChild(errorText);
    actions.appendChild(actionButtons);

    section.appendChild(heading);
    section.appendChild(helper);
    section.appendChild(editorEl);
    section.appendChild(actions);
    section.appendChild(diagnosticsList);
    body.appendChild(section);

    const footerContainer = createFooterStatusContainer();
    footerContainer.style.marginTop = "6px";
    footerContainer.style.paddingTop = "0";
    footerContainer.style.borderTop = "none";
    styleFooterStatusBar(status);
    renderFooterStatusBar(
      status,
      footerStatusMode,
      footerPassedCount,
      footerTotalCount,
      footerStatusActionLabel,
      footerDiagnosticsSummary
    );
    status.style.marginTop = "0";
    status.style.marginLeft = "0";
    status.style.marginRight = "0";
    status.style.marginBottom = "0";
    footerContainer.appendChild(status);
    body.appendChild(footerContainer);
    scheduleClampWidgetIntoViewport();
  };

  return {
    isOpen: () => isOpen,
    open,
    close,
    cancel,
    apply,
    renderPanel,
  };
}
