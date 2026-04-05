import type { LayoutLintMonitorController } from "../monitor/types.js";
import type { FooterStatusMode } from "./footer-status.js";

interface RenderSpecEditorPanelArgs {
  body: HTMLDivElement;
  status: HTMLSpanElement;
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

  const close = () => {
    isOpen = false;
    error = null;
    args.updateHeaderToggleStyles();
  };

  const open = () => {
    isOpen = true;
    draft = args.monitor.getSpecText();
    error = null;
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
      args.setFooterStatusActionLabel(args.specUpdateStatusLabel);
      isOpen = false;
      args.updateHeaderToggleStyles();
      args.setFooterStatusMode("loading");
      if (args.isStatusTransitionDelayEnabled()) {
        await delay(args.fakeLoadingDurationMs);
      }
      args.monitor.setSpecText(nextSpec);
      await args.monitor.evaluateNow();
      close();
      args.flashFooterStatusDone();
    } catch (cause) {
      args.monitor.setSpecText(previousSpec);
      try {
        await args.monitor.evaluateNow();
      } catch {
        // keep prior spec restoration best effort
      }
      error = cause instanceof Error ? cause.message : "Failed to apply spec.";
      isOpen = true;
      args.updateHeaderToggleStyles();
      args.showFooterErrorAndReset();
      args.requestRerender();
    }
  };

  const renderPanel = ({ body, status, scheduleClampWidgetIntoViewport }: RenderSpecEditorPanelArgs) => {
    body.innerHTML = "";
    status.textContent = "";
    body.style.display = "block";
    body.style.flexDirection = "";
    body.style.overflow = "auto";
    body.style.minHeight = "";
    body.style.padding = "8px 10px";
    body.style.paddingBottom = "8px";

    const section = document.createElement("div");
    section.style.display = "grid";
    section.style.gap = "8px";
    section.style.padding = "10px";
    section.style.border = "1px solid #dbe3ff";
    section.style.borderRadius = "10px";
    section.style.background = "linear-gradient(180deg, #f8faff 0%, #eef2ff 100%)";

    const heading = document.createElement("div");
    heading.textContent = "Edit Layout Spec";
    heading.style.fontSize = "12px";
    heading.style.fontWeight = "700";
    heading.style.color = "#1f2937";

    const helper = document.createElement("div");
    helper.textContent = "Apply with Cmd/Ctrl+Enter.";
    helper.style.fontSize = "10px";
    helper.style.color = "#6b7280";

    const textArea = document.createElement("textarea");
    textArea.value = draft;
    textArea.spellcheck = false;
    textArea.rows = 10;
    textArea.style.width = "100%";
    textArea.style.boxSizing = "border-box";
    textArea.style.resize = "vertical";
    textArea.style.minHeight = "160px";
    textArea.style.padding = "8px";
    textArea.style.border = "1px solid #a5b4fc";
    textArea.style.borderRadius = "8px";
    textArea.style.fontSize = "11px";
    textArea.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    textArea.style.lineHeight = "1.4";
    textArea.style.background = "#ffffff";
    textArea.style.color = "#1f2937";
    textArea.style.outline = "none";
    textArea.addEventListener("pointerdown", (event) => event.stopPropagation());
    textArea.addEventListener("input", () => {
      draft = textArea.value;
      error = null;
    });
    textArea.addEventListener("keydown", (event) => {
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

    const errorText = document.createElement("span");
    errorText.style.fontSize = "10px";
    errorText.style.color = "#b91c1c";
    errorText.textContent = error ?? "";

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
    section.appendChild(textArea);
    section.appendChild(actions);
    body.appendChild(section);
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
