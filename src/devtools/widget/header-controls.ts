const TOGGLE_TRANSITION =
  "box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease, color 120ms ease";

const applyBaseHeaderToggleStyles = (button: HTMLButtonElement) => {
  button.style.border = "1px solid rgba(255,255,255,0.6)";
  button.style.borderRadius = "999px";
  button.style.background = "transparent";
  button.style.color = "#ffffff";
  button.style.cursor = "pointer";
  button.style.outline = "none";
  button.style.transition = TOGGLE_TRANSITION;
  button.addEventListener("focus", () => {
    button.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.28)";
  });
  button.addEventListener("blur", () => {
    button.style.boxShadow = "none";
  });
};

const createHeaderToggleButton = (label: string, fontSize = "11px", padding = "2px 8px") => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.fontSize = fontSize;
  button.style.padding = padding;
  applyBaseHeaderToggleStyles(button);
  return button;
};

export interface WidgetHeaderControls {
  header: HTMLDivElement;
  constraintsToggle: HTMLButtonElement;
  settingsToggle: HTMLButtonElement;
  specToggle: HTMLButtonElement;
  minimizeToggle: HTMLButtonElement;
}

export const setHeaderToggleActive = (button: HTMLButtonElement, isActive: boolean) => {
  button.style.borderColor = isActive ? "#ffffff" : "rgba(255,255,255,0.6)";
  button.style.background = isActive ? "#ffffff" : "transparent";
  button.style.color = isActive ? "#4f46e5" : "#ffffff";
};

export const createWidgetHeaderControls = (titleText: string): WidgetHeaderControls => {
  const header = document.createElement("div");
  header.style.padding = "8px 10px";
  header.style.cursor = "move";
  header.style.userSelect = "none";
  header.style.background = "#7a81ff";
  header.style.color = "#ffffff";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("span");
  title.textContent = titleText;
  title.style.fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  title.style.fontWeight = "300";
  title.style.letterSpacing = "0.01em";
  title.style.whiteSpace = "nowrap";
  title.style.flexShrink = "0";
  header.appendChild(title);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.gap = "8px";

  const constraintsToggle = createHeaderToggleButton("constraints");
  const settingsToggle = createHeaderToggleButton("settings");
  const specToggle = createHeaderToggleButton("spec");
  const minimizeToggle = createHeaderToggleButton("▾", "14px", "3px 8px");
  minimizeToggle.style.fontWeight = "700";
  minimizeToggle.style.lineHeight = "1";
  minimizeToggle.style.minWidth = "30px";
  minimizeToggle.title = "minimize widget";

  controls.appendChild(specToggle);
  controls.appendChild(constraintsToggle);
  controls.appendChild(settingsToggle);
  controls.appendChild(minimizeToggle);
  header.appendChild(controls);

  return {
    header,
    constraintsToggle,
    settingsToggle,
    specToggle,
    minimizeToggle,
  };
};
