export type FooterStatusMode = "ready" | "loading" | "done" | "error";

export const styleFooterStatusBar = (status: HTMLSpanElement) => {
  status.style.display = "flex";
  status.style.alignItems = "center";
  status.style.justifyContent = "space-between";
  status.style.gap = "10px";
  status.style.width = "100%";
  status.style.boxSizing = "border-box";
  status.style.padding = "6px 10px";
  status.style.borderTop = "1px solid #d1d5db";
  status.style.borderLeft = "none";
  status.style.borderRight = "none";
  status.style.borderBottom = "none";
  status.style.borderRadius = "0 0 10px 10px";
  status.style.background = "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)";
  status.style.fontSize = "10px";
  status.style.color = "#334155";
  status.style.whiteSpace = "normal";
};

export const renderFooterStatusBar = (
  status: HTMLSpanElement,
  mode: FooterStatusMode,
  passed: number,
  total: number,
  actionLabel = "reevaluating..."
) => {
  status.innerHTML = "";
  const allConstraintsMet = total > 0 && passed === total;

  const left = document.createElement("span");
  left.style.display = "inline-flex";
  left.style.alignItems = "center";
  left.style.gap = "6px";
  left.style.minWidth = "0";
  left.style.flex = "1 1 auto";

  const createStatusWord = (text: string, color: string) => {
    const word = document.createElement("span");
    word.textContent = text;
    word.style.fontSize = "9px";
    word.style.fontWeight = "700";
    word.style.letterSpacing = "0.02em";
    word.style.textTransform = "uppercase";
    word.style.color = color;
    word.style.whiteSpace = "nowrap";
    return word;
  };

  const liveDot = document.createElement("span");
  liveDot.style.width = "7px";
  liveDot.style.height = "7px";
  liveDot.style.borderRadius = "999px";
  liveDot.style.background = mode === "error" ? "#ef4444" : mode === "loading" ? "#94a3b8" : mode === "done" ? "#10b981" : "#94a3b8";
  liveDot.style.boxShadow =
    mode === "error"
      ? "0 0 0 2px rgba(239, 68, 68, 0.14)"
      : mode === "loading"
        ? "0 0 0 2px rgba(148, 163, 184, 0.18)"
        : mode === "done"
          ? "0 0 0 2px rgba(16, 185, 129, 0.18)"
          : "0 0 0 2px rgba(148, 163, 184, 0.18)";

  left.appendChild(liveDot);
  if (mode === "loading") {
    left.appendChild(createStatusWord(actionLabel, "#64748b"));
  } else if (mode === "done") {
    left.appendChild(createStatusWord(actionLabel, "#166534"));
    left.appendChild(createStatusWord("done", "#166534"));
  } else if (mode === "error") {
    left.appendChild(createStatusWord("error", "#b91c1c"));
  } else {
    left.appendChild(createStatusWord("ready", "#64748b"));
  }

  const right = document.createElement("span");
  right.style.display = "inline-flex";
  right.style.alignItems = "baseline";
  right.style.gap = "3px";
  right.style.flex = "0 0 auto";
  right.style.whiteSpace = "nowrap";
  right.title = "constraints met";

  if (allConstraintsMet) {
    const rightCheck = document.createElement("span");
    rightCheck.textContent = "✓";
    rightCheck.style.fontSize = "10px";
    rightCheck.style.fontWeight = "800";
    rightCheck.style.color = "#10b981";
    rightCheck.style.marginRight = "1px";
    right.appendChild(rightCheck);
  }

  const passedValue = document.createElement("span");
  passedValue.textContent = `${passed}`;
  passedValue.style.fontSize = "10px";
  passedValue.style.fontWeight = "800";
  passedValue.style.color = "#1f2937";

  const separator = document.createElement("span");
  separator.textContent = "/";
  separator.style.fontSize = "10px";
  separator.style.fontWeight = "700";
  separator.style.color = "#94a3b8";

  const totalValue = document.createElement("span");
  totalValue.textContent = `${total}`;
  totalValue.style.fontSize = "10px";
  totalValue.style.fontWeight = "800";
  totalValue.style.color = "#1f2937";

  right.appendChild(passedValue);
  right.appendChild(separator);
  right.appendChild(totalValue);

  status.appendChild(left);
  status.appendChild(right);
};