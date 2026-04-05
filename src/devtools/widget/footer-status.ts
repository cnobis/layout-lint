export const styleFooterStatusBar = (status: HTMLSpanElement) => {
  status.style.display = "flex";
  status.style.alignItems = "center";
  status.style.justifyContent = "space-between";
  status.style.gap = "6px";
  status.style.width = "100%";
  status.style.boxSizing = "border-box";
  status.style.padding = "6px 10px";
  status.style.borderTop = "1px solid #6366f1";
  status.style.borderLeft = "none";
  status.style.borderRight = "none";
  status.style.borderBottom = "none";
  status.style.borderRadius = "0 0 10px 10px";
  status.style.background = "#7a81ff";
  status.style.fontSize = "10px";
  status.style.color = "#eef2ff";
  status.style.whiteSpace = "normal";
};

export const renderFooterStatusBar = (status: HTMLSpanElement, passed: number, total: number) => {
  status.innerHTML = "";

  const left = document.createElement("span");
  left.textContent = "ready";
  left.style.fontSize = "9px";
  left.style.fontWeight = "700";
  left.style.color = "#e0e7ff";

  const right = document.createElement("span");
  right.textContent = `${passed}/${total} constraints met`;
  right.style.fontSize = "10px";
  right.style.fontWeight = "700";
  right.style.color = "#ffffff";

  status.appendChild(left);
  status.appendChild(right);
};