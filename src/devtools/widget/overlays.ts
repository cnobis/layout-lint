export interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function createOverlayRenderer(highlightLayer: HTMLDivElement) {
  const placedLabelRects: LabelRect[] = [];
  const transparentLabelsEnabled = true;

  const getNumberBadgeStyles = (color: string) => {
    const normalized = color.toLowerCase();
    const isPass = normalized === "#059669";
    const isFail = normalized === "#dc2626";

    if (isPass) {
      return {
        border: "1px solid #34d399",
        background: "#d1fae5",
        color: "#065f46",
      };
    }

    if (isFail) {
      return {
        border: "1px solid #f87171",
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      border: "1px solid #d1d5db",
      background: "#f3f4f6",
      color: "#111827",
    };
  };

  const getHeadlineTextColor = (color: string) => {
    const normalized = color.toLowerCase();
    if (normalized === "#059669") return "#065f46";
    if (normalized === "#dc2626") return "#991b1b";
    return "#334155";
  };

  const clear = () => {
    highlightLayer.innerHTML = "";
    placedLabelRects.length = 0;
  };

  const createHighlightBox = (element: HTMLElement, color: string, dashed = false) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return;

    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `2px ${dashed ? "dashed" : "solid"} ${color}`;
    box.style.borderRadius = "6px";
    box.style.background = `${color}22`;
    box.style.boxSizing = "border-box";
    highlightLayer.appendChild(box);
  };

  const createOverlayLabel = (text: string, color: string, x: number, y: number) => {
    const margin = 6;
    const label = document.createElement("div");
    label.style.position = "fixed";
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.maxWidth = "280px";
    label.style.padding = "4px 7px";
    label.style.border = `1px solid ${color}`;
    label.style.borderRadius = "6px";
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.background = transparentLabelsEnabled ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.96)";
    label.style.color = "#111827";
    label.style.textShadow = "none";
    label.style.backdropFilter = transparentLabelsEnabled ? "blur(2px) saturate(110%)" : "none";
    label.style.setProperty(
      "-webkit-backdrop-filter",
      transparentLabelsEnabled ? "blur(2px) saturate(110%)" : "none"
    );
    label.style.font = "11px/1.35 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";

    const numberedLabelMatch = text.match(/^(\?|\d+)\s*(?:•\s*)?(.*)$/);
    if (numberedLabelMatch && numberedLabelMatch[2]) {
      const firstSegment = numberedLabelMatch[1];
      const remainder = numberedLabelMatch[2];
      const head = document.createElement("span");
      head.style.display = "inline-flex";
      head.style.alignItems = "center";
      head.style.gap = "6px";

      const numberPart = document.createElement("span");
      const badgeStyles = getNumberBadgeStyles(color);
      numberPart.style.display = "inline-flex";
      numberPart.style.alignItems = "center";
      numberPart.style.justifyContent = "center";
      numberPart.style.minWidth = "26px";
      numberPart.style.padding = "1px 7px";
      numberPart.style.borderRadius = "999px";
      numberPart.style.fontSize = "10px";
      numberPart.style.lineHeight = "1.3";
      numberPart.style.fontWeight = "700";
      numberPart.style.border = badgeStyles.border;
      numberPart.style.background = badgeStyles.background;
      numberPart.style.color = badgeStyles.color;
      numberPart.style.flex = "0 0 auto";
      numberPart.textContent = firstSegment;
      head.appendChild(numberPart);

      const headText = document.createElement("span");
      headText.style.fontWeight = "600";
      headText.style.color = getHeadlineTextColor(color);
      headText.textContent = remainder;
      head.appendChild(headText);

      label.appendChild(head);
    } else {
      label.textContent = text;
    }

    highlightLayer.appendChild(label);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const labelWidth = label.offsetWidth;
    const labelHeight = label.offsetHeight;

    const clampX = (value: number) =>
      Math.min(Math.max(margin, value), Math.max(margin, viewportWidth - labelWidth - margin));
    const clampY = (value: number) =>
      Math.min(Math.max(margin, value), Math.max(margin, viewportHeight - labelHeight - margin));

    const intersectsPlaced = (left: number, top: number) => {
      const right = left + labelWidth;
      const bottom = top + labelHeight;
      return placedLabelRects.some(
        (rect) => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top
      );
    };

    let finalX = clampX(x);
    let finalY = clampY(y);

    if (intersectsPlaced(finalX, finalY)) {
      const step = labelHeight + 6;
      let found = false;

      for (let i = 1; i <= 12; i++) {
        const downY = clampY(y + step * i);
        if (!intersectsPlaced(finalX, downY)) {
          finalY = downY;
          found = true;
          break;
        }

        const upY = clampY(y - step * i);
        if (!intersectsPlaced(finalX, upY)) {
          finalY = upY;
          found = true;
          break;
        }
      }

      if (!found) {
        for (let i = 1; i <= 8; i++) {
          const rightX = clampX(x + i * 16);
          if (!intersectsPlaced(rightX, finalY)) {
            finalX = rightX;
            found = true;
            break;
          }

          const leftX = clampX(x - i * 16);
          if (!intersectsPlaced(leftX, finalY)) {
            finalX = leftX;
            found = true;
            break;
          }
        }
      }
    }

    label.style.left = `${finalX}px`;
    label.style.top = `${finalY}px`;

    placedLabelRects.push({
      left: finalX,
      top: finalY,
      right: finalX + labelWidth,
      bottom: finalY + labelHeight,
    });

    return { width: labelWidth, height: labelHeight };
  };

  const createElementRoleLabel = (
    text: string,
    color: string,
    rect: DOMRect,
    preferAbove: boolean
  ) => {
    const gap = 8;
    const viewportHeight = window.innerHeight;

    const aboveY = rect.top - 28;
    const belowY = rect.bottom + gap;
    const hasAboveSpace = aboveY >= 6;
    const hasBelowSpace = belowY <= viewportHeight - 6;

    let y = preferAbove ? aboveY : belowY;
    if (preferAbove && !hasAboveSpace && hasBelowSpace) y = belowY;
    if (!preferAbove && !hasBelowSpace && hasAboveSpace) y = aboveY;

    createOverlayLabel(text, color, rect.left, y);
  };

  const createConnector = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    labelText?: string
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const line = document.createElement("div");
    line.style.position = "fixed";
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.width = `${length}px`;
    line.style.height = "2px";
    line.style.background = color;
    line.style.transformOrigin = "0 50%";
    line.style.transform = `rotate(${Math.atan2(dy, dx) * (180 / Math.PI)}deg)`;
    highlightLayer.appendChild(line);

    if (labelText) {
      const labelX = (x1 + x2) / 2 - 90;
      const labelY = (y1 + y2) / 2 - 18;
      createOverlayLabel(labelText, color, labelX, labelY);
    }
  };

  const formatMeasurement = (value: number | string | null | undefined) => {
    if (value == null) return "n/a";
    if (typeof value === "string") return value;
    return Number.isInteger(value) ? `${value}px` : `${value.toFixed(2)}px`;
  };

  const getDirectionalConnectorPoints = (
    relation: string,
    elementRect: DOMRect,
    targetRect: DOMRect
  ) => {
    const elementCenterX = elementRect.left + elementRect.width / 2;
    const elementCenterY = elementRect.top + elementRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    switch (relation) {
      case "below":
        return { x1: targetCenterX, y1: targetRect.bottom, x2: elementCenterX, y2: elementRect.top };
      case "above":
        return { x1: targetCenterX, y1: targetRect.top, x2: elementCenterX, y2: elementRect.bottom };
      case "right-of":
        return { x1: targetRect.right, y1: targetCenterY, x2: elementRect.left, y2: elementCenterY };
      case "left-of":
        return { x1: elementRect.right, y1: elementCenterY, x2: targetRect.left, y2: targetCenterY };
      default:
        return null;
    }
  };

  const getEqualGapConnectorPoints = (
    relation: string,
    sourceRect: DOMRect,
    middleRect: DOMRect,
    endRect: DOMRect
  ) => {
    if (relation === "equal-gap-x") {
      const gapY1 = (sourceRect.top + sourceRect.bottom + middleRect.top + middleRect.bottom) / 4;
      const gapY2 = (middleRect.top + middleRect.bottom + endRect.top + endRect.bottom) / 4;
      return [
        { x1: sourceRect.right, y1: gapY1, x2: middleRect.left, y2: gapY1 },
        { x1: middleRect.right, y1: gapY2, x2: endRect.left, y2: gapY2 },
      ];
    }

    if (relation === "equal-gap-y") {
      const gapX1 = (sourceRect.left + sourceRect.right + middleRect.left + middleRect.right) / 4;
      const gapX2 = (middleRect.left + middleRect.right + endRect.left + endRect.right) / 4;
      return [
        { x1: gapX1, y1: sourceRect.bottom, x2: gapX1, y2: middleRect.top },
        { x1: gapX2, y1: middleRect.bottom, x2: gapX2, y2: endRect.top },
      ];
    }

    return null;
  };

  return {
    clear,
    createHighlightBox,
    createElementRoleLabel,
    createConnector,
    formatMeasurement,
    getDirectionalConnectorPoints,
    getEqualGapConnectorPoints,
  };
}
