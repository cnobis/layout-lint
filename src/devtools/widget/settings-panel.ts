import type { LayoutLintWidgetSettings } from "./types.js";

interface RenderWidgetSettingsPanelArgs {
  body: HTMLDivElement;
  settings: LayoutLintWidgetSettings;
  clampConstraintsPerPage: (value: number) => number;
  onUpdateSettings: (patch: Partial<LayoutLintWidgetSettings>) => void;
  onResetSize: () => void;
  onResetDefaults: () => void;
  scheduleClampWidgetIntoViewport: () => void;
}

export const renderWidgetSettingsPanel = ({
  body,
  settings,
  clampConstraintsPerPage,
  onUpdateSettings,
  onResetSize,
  onResetDefaults,
  scheduleClampWidgetIntoViewport,
}: RenderWidgetSettingsPanelArgs) => {
  body.innerHTML = "";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.overflow = "hidden";
  body.style.minHeight = "0";
  body.style.padding = "8px 10px";
  body.style.paddingBottom = "8px";

  const section = document.createElement("div");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.flex = "1 1 auto";
  section.style.minHeight = "0";
  section.style.overflowY = "auto";
  section.style.gap = "10px";
  section.style.padding = "10px";
  section.style.border = "1px solid #dbe3ff";
  section.style.borderRadius = "10px";
  section.style.background = "linear-gradient(180deg, #f8faff 0%, #eef2ff 100%)";

  const createToggleRow = (
    label: string,
    description: string,
    checked: boolean,
    onChange: (nextValue: boolean) => void
  ) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "8px 10px";
    row.style.border = "1px solid #c7d2fe";
    row.style.borderRadius = "8px";
    row.style.background = "rgba(255,255,255,0.85)";

    const textWrap = document.createElement("div");
    textWrap.style.display = "grid";
    textWrap.style.gap = "1px";

    const title = document.createElement("div");
    title.textContent = label;
    title.style.fontSize = "11px";
    title.style.fontWeight = "700";
    title.style.color = "#1f2937";

    const subtitle = document.createElement("div");
    subtitle.textContent = description;
    subtitle.style.fontSize = "10px";
    subtitle.style.color = "#6b7280";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = checked ? "On" : "Off";
    toggle.style.minWidth = "44px";
    toggle.style.padding = "3px 10px";
    toggle.style.borderRadius = "999px";
    toggle.style.border = checked ? "1px solid #6366f1" : "1px solid #9ca3af";
    toggle.style.background = checked ? "#e0e7ff" : "#f3f4f6";
    toggle.style.color = checked ? "#3730a3" : "#4b5563";
    toggle.style.fontSize = "10px";
    toggle.style.fontWeight = "700";
    toggle.style.cursor = "pointer";
    toggle.style.outline = "none";
    toggle.style.transition = "box-shadow 120ms ease";
    toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
    toggle.addEventListener("focus", () => {
      toggle.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
    });
    toggle.addEventListener("blur", () => {
      toggle.style.boxShadow = "none";
    });
    toggle.addEventListener("click", () => {
      onChange(!checked);
    });

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    row.appendChild(textWrap);
    row.appendChild(toggle);
    return row;
  };

  const highlightRow = createToggleRow(
    "Highlights",
    "Show overlays on linked elements",
    settings.highlightsEnabled,
    (nextValue) => {
      onUpdateSettings({ highlightsEnabled: nextValue });
    }
  );

  const tabsRow = createToggleRow(
    "Tabs",
    "Split constraints into navigable pages",
    settings.tabsEnabled,
    (nextValue) => {
      onUpdateSettings({ tabsEnabled: nextValue });
    }
  );

  const fakeLoadingRow = createToggleRow(
    "Delay",
    "Show brief visual feedback until result updates",
    settings.statusTransitionDelayEnabled,
    (nextValue) => {
      onUpdateSettings({ statusTransitionDelayEnabled: nextValue });
    }
  );

  const thresholdWrap = document.createElement("div");
  thresholdWrap.style.display = "grid";
  thresholdWrap.style.gap = "4px";
  thresholdWrap.style.padding = "8px 10px";
  const thresholdEnabled = settings.tabsEnabled;
  thresholdWrap.style.border = thresholdEnabled ? "1px solid #c7d2fe" : "1px solid #d1d5db";
  thresholdWrap.style.borderRadius = "8px";
  thresholdWrap.style.background = thresholdEnabled ? "rgba(255,255,255,0.85)" : "rgba(243,244,246,0.9)";
  thresholdWrap.style.opacity = thresholdEnabled ? "1" : "0.8";

  const thresholdLabel = document.createElement("label");
  thresholdLabel.textContent = "Constraints Per Page";
  thresholdLabel.style.fontWeight = "700";
  thresholdLabel.style.fontSize = "11px";
  thresholdLabel.style.color = "#1f2937";

  const thresholdInput = document.createElement("input");
  thresholdInput.type = "text";
  thresholdInput.inputMode = "numeric";
  thresholdInput.pattern = "[0-9]*";
  thresholdInput.maxLength = 3;
  thresholdInput.disabled = !thresholdEnabled;
  thresholdInput.value = `${settings.constraintsPerPage}`;
  thresholdInput.style.border = thresholdEnabled ? "1px solid #a5b4fc" : "1px solid #d1d5db";
  thresholdInput.style.borderRadius = "6px";
  thresholdInput.style.padding = "6px 8px";
  thresholdInput.style.fontSize = "12px";
  thresholdInput.style.background = thresholdEnabled ? "#ffffff" : "#f3f4f6";
  thresholdInput.style.color = thresholdEnabled ? "#111827" : "#6b7280";
  thresholdInput.style.outline = "none";
  thresholdInput.style.boxShadow = "none";
  thresholdInput.style.transition = "border-color 120ms ease, box-shadow 120ms ease";
  thresholdInput.addEventListener("pointerdown", (event) => event.stopPropagation());

  const commitThresholdValue = () => {
    const raw = Number.parseInt(thresholdInput.value, 10);
    const nextValue = clampConstraintsPerPage(Number.isFinite(raw) ? raw : settings.constraintsPerPage);
    thresholdInput.value = `${nextValue}`;
    onUpdateSettings({ constraintsPerPage: nextValue });
  };

  thresholdInput.addEventListener("input", () => {
    const digitsOnly = thresholdInput.value.replace(/[^0-9]/g, "").slice(0, 3);
    if (digitsOnly !== thresholdInput.value) {
      thresholdInput.value = digitsOnly;
    }
  });

  thresholdInput.addEventListener("blur", commitThresholdValue);
  thresholdInput.addEventListener("focus", () => {
    thresholdInput.style.borderColor = "#6366f1";
    thresholdInput.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
  });
  thresholdInput.addEventListener("blur", () => {
    thresholdInput.style.borderColor = "#a5b4fc";
    thresholdInput.style.boxShadow = "none";
  });
  thresholdInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    commitThresholdValue();
  });

  const helper = document.createElement("div");
  helper.style.fontSize = "10px";
  helper.style.color = "#6b7280";
  helper.textContent = "Allowed range: 5 to 200";

  thresholdWrap.appendChild(thresholdLabel);
  thresholdWrap.appendChild(thresholdInput);
  thresholdWrap.appendChild(helper);

  const createActionButton = (label: string, onClick: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.padding = "6px 8px";
    button.style.fontSize = "11px";
    button.style.fontWeight = "600";
    button.style.border = "1px solid #d1d5db";
    button.style.borderRadius = "6px";
    button.style.background = "#f3f4f6";
    button.style.color = "#374151";
    button.style.cursor = "pointer";
    button.style.transition = "all 120ms ease";
    button.style.outline = "none";
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", onClick);
    button.addEventListener("focus", () => {
      button.style.borderColor = "#6366f1";
      button.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.22)";
    });
    button.addEventListener("blur", () => {
      button.style.borderColor = "#d1d5db";
      button.style.boxShadow = "none";
    });
    button.addEventListener("pointerenter", () => {
      button.style.background = "#e5e7eb";
      button.style.borderColor = "#9ca3af";
    });
    button.addEventListener("pointerleave", () => {
      button.style.background = "#f3f4f6";
      button.style.borderColor = "#d1d5db";
    });
    return button;
  };

  const actionButtons = document.createElement("div");
  actionButtons.style.display = "flex";
  actionButtons.style.gap = "8px";
  actionButtons.style.marginTop = "auto";

  const resetSizeButton = createActionButton("Reset Size", () => {
    onResetSize();
  });

  const resetDefaultsButton = createActionButton("Reset Defaults", () => {
    onResetDefaults();
  });

  actionButtons.appendChild(resetDefaultsButton);
  actionButtons.appendChild(resetSizeButton);

  section.appendChild(highlightRow);
  section.appendChild(tabsRow);
  section.appendChild(thresholdWrap);
  section.appendChild(fakeLoadingRow);
  section.appendChild(actionButtons);
  body.appendChild(section);
  scheduleClampWidgetIntoViewport();
};
