type EdgeHandleDirection = "n" | "s" | "e" | "w";
type ResizeDirection = EdgeHandleDirection | "ne" | "nw" | "se" | "sw";

interface WidgetResizeBounds {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

interface CreateWidgetResizeControllerArgs {
  root: HTMLDivElement;
  getBounds: () => WidgetResizeBounds;
  onResize: () => void;
  onResizeEnd: (size: { widthPx: number; heightPx: number }) => void;
}

export interface WidgetResizeController {
  setup(): void;
  destroy(): void;
  setHandlesVisible(visible: boolean): void;
  setEnabled(enabled: boolean): void;
}

const HANDLE_SIZE_PX = 12;
const VIEWPORT_MARGIN_PX = 8;

const applyHandleVisualStyles = (handle: HTMLDivElement, direction: EdgeHandleDirection, emphasized: boolean) => {
  const edgeAlpha = emphasized ? "0.5" : "0.2";
  const edgeStyle = `1px solid rgba(99, 102, 241, ${edgeAlpha})`;

  handle.style.border = "none";
  handle.style.boxShadow = "none";
  handle.style.borderRadius = "0";

  if (direction === "n") {
    handle.style.borderTop = edgeStyle;
    return;
  }
  if (direction === "s") {
    handle.style.borderBottom = edgeStyle;
    return;
  }
  if (direction === "e") {
    handle.style.borderRight = edgeStyle;
    return;
  }
  if (direction === "w") {
    handle.style.borderLeft = edgeStyle;
    return;
  }
};

const toCursor = (direction: ResizeDirection): string => {
  if (direction === "n" || direction === "s") return "ns-resize";
  if (direction === "e" || direction === "w") return "ew-resize";
  if (direction === "ne" || direction === "sw") return "nesw-resize";
  return "nwse-resize";
};

const applyHandlePositionStyles = (handle: HTMLDivElement, direction: EdgeHandleDirection) => {
  const edgeSize = `${HANDLE_SIZE_PX}px`;
  handle.style.position = "absolute";
  handle.style.zIndex = "30";
  handle.style.userSelect = "none";
  handle.style.touchAction = "none";
  handle.style.cursor = toCursor(direction);
  handle.style.background = "transparent";

  if (direction === "n") {
    handle.style.left = "0";
    handle.style.right = "0";
    handle.style.top = "0";
    handle.style.height = edgeSize;
    return;
  }
  if (direction === "s") {
    handle.style.left = "0";
    handle.style.right = "0";
    handle.style.bottom = "0";
    handle.style.height = edgeSize;
    return;
  }
  if (direction === "e") {
    handle.style.top = "0";
    handle.style.bottom = "0";
    handle.style.right = "0";
    handle.style.width = edgeSize;
    return;
  }
  if (direction === "w") {
    handle.style.top = "0";
    handle.style.bottom = "0";
    handle.style.left = "0";
    handle.style.width = edgeSize;
    return;
  }

};

export function createWidgetResizeController({
  root,
  getBounds,
  onResize,
  onResizeEnd,
}: CreateWidgetResizeControllerArgs): WidgetResizeController {
  const handles = new Map<EdgeHandleDirection, HTMLDivElement>();
  let enabled = true;
  let visible = true;
  let activeDirection: ResizeDirection | null = null;
  let gestureStartX = 0;
  let gestureStartY = 0;
  let startLeft = 0;
  let startTop = 0;
  let startWidth = 0;
  let startHeight = 0;
  let previousTransition = "";
  let isHandleHoverEmphasized = false;

  const cornerProximityPx = () => {
    const rect = root.getBoundingClientRect();
    return Math.min(18, Math.max(10, Math.round(Math.min(rect.width, rect.height) * 0.1)));
  };

  const getResizeDirectionFromEdge = (edge: EdgeHandleDirection, event: PointerEvent): ResizeDirection => {
    const rect = root.getBoundingClientRect();
    const proximity = cornerProximityPx();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const nearLeft = relativeX <= proximity;
    const nearRight = rect.width - relativeX <= proximity;
    const nearTop = relativeY <= proximity;
    const nearBottom = rect.height - relativeY <= proximity;

    if (edge === "n") {
      if (nearLeft) return "nw";
      if (nearRight) return "ne";
      return "n";
    }
    if (edge === "s") {
      if (nearLeft) return "sw";
      if (nearRight) return "se";
      return "s";
    }
    if (edge === "e") {
      if (nearTop) return "ne";
      if (nearBottom) return "se";
      return "e";
    }
    if (nearTop) return "nw";
    if (nearBottom) return "sw";
    return "w";
  };

  const setHandleDisplay = () => {
    const nextDisplay = visible ? "block" : "none";
    for (const handle of handles.values()) {
      handle.style.display = nextDisplay;
    }
  };

  const updateHandleVisualState = () => {
    for (const [direction, handle] of handles.entries()) {
      applyHandleVisualStyles(handle, direction, isHandleHoverEmphasized);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!activeDirection) return;

    const dx = event.clientX - gestureStartX;
    const dy = event.clientY - gestureStartY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const bounds = getBounds();

    const maxWidthByViewport = Math.max(bounds.minWidth, viewportWidth - VIEWPORT_MARGIN_PX * 2);
    const maxHeightByViewport = Math.max(bounds.minHeight, viewportHeight - VIEWPORT_MARGIN_PX * 2);
    const maxWidth = Math.min(bounds.maxWidth, maxWidthByViewport);
    const maxHeight = Math.min(bounds.maxHeight, maxHeightByViewport);

    const rightEdge = startLeft + startWidth;
    const bottomEdge = startTop + startHeight;

    let nextLeft = startLeft;
    let nextTop = startTop;
    let nextWidth = startWidth;
    let nextHeight = startHeight;

    if (activeDirection.includes("e")) {
      nextWidth = Math.min(Math.max(startWidth + dx, bounds.minWidth), maxWidth);
      nextWidth = Math.min(nextWidth, viewportWidth - VIEWPORT_MARGIN_PX - nextLeft);
    }

    if (activeDirection.includes("s")) {
      nextHeight = Math.min(Math.max(startHeight + dy, bounds.minHeight), maxHeight);
      nextHeight = Math.min(nextHeight, viewportHeight - VIEWPORT_MARGIN_PX - nextTop);
    }

    if (activeDirection.includes("w")) {
      const candidateLeft = startLeft + dx;
      const minLeft = VIEWPORT_MARGIN_PX;
      const maxLeft = rightEdge - bounds.minWidth;
      nextLeft = Math.min(Math.max(candidateLeft, minLeft), maxLeft);
      nextWidth = rightEdge - nextLeft;
      if (nextWidth > maxWidth) {
        nextWidth = maxWidth;
        nextLeft = rightEdge - nextWidth;
      }
    }

    if (activeDirection.includes("n")) {
      const candidateTop = startTop + dy;
      const minTop = VIEWPORT_MARGIN_PX;
      const maxTop = bottomEdge - bounds.minHeight;
      nextTop = Math.min(Math.max(candidateTop, minTop), maxTop);
      nextHeight = bottomEdge - nextTop;
      if (nextHeight > maxHeight) {
        nextHeight = maxHeight;
        nextTop = bottomEdge - nextHeight;
      }
    }

    nextLeft = Math.max(VIEWPORT_MARGIN_PX, Math.min(nextLeft, viewportWidth - VIEWPORT_MARGIN_PX - nextWidth));
    nextTop = Math.max(VIEWPORT_MARGIN_PX, Math.min(nextTop, viewportHeight - VIEWPORT_MARGIN_PX - nextHeight));

    root.style.left = `${Math.round(nextLeft)}px`;
    root.style.top = `${Math.round(nextTop)}px`;
    root.style.width = `${Math.round(nextWidth)}px`;
    root.style.height = `${Math.round(nextHeight)}px`;
    onResize();
  };

  const onPointerUp = () => {
    if (!activeDirection) return;
    activeDirection = null;
    root.style.transition = previousTransition;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const rect = root.getBoundingClientRect();
    onResizeEnd({
      widthPx: Math.round(rect.width),
      heightPx: Math.round(rect.height),
    });
  };

  const startResize = (edge: EdgeHandleDirection, event: PointerEvent) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = root.getBoundingClientRect();
    activeDirection = getResizeDirectionFromEdge(edge, event);
    gestureStartX = event.clientX;
    gestureStartY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    startWidth = rect.width;
    startHeight = rect.height;
    previousTransition = root.style.transition;
    root.style.transition = "none";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const createHandle = (direction: EdgeHandleDirection) => {
    const handle = document.createElement("div");
    handle.dataset.layoutLintWidgetResize = direction;
    applyHandlePositionStyles(handle, direction);
    applyHandleVisualStyles(handle, direction, false);
    handle.addEventListener("pointermove", (event) => {
      handle.style.cursor = toCursor(getResizeDirectionFromEdge(direction, event));
    });
    handle.addEventListener("pointerdown", (event) => {
      startResize(direction, event);
    });
    return handle;
  };

  const onRootPointerEnter = () => {
    isHandleHoverEmphasized = true;
    updateHandleVisualState();
  };

  const onRootPointerLeave = () => {
    isHandleHoverEmphasized = false;
    updateHandleVisualState();
  };

  const setup = () => {
    const directions: EdgeHandleDirection[] = ["n", "s", "e", "w"];
    for (const direction of directions) {
      const handle = createHandle(direction);
      handles.set(direction, handle);
      root.appendChild(handle);
    }
    root.addEventListener("pointerenter", onRootPointerEnter);
    root.addEventListener("pointerleave", onRootPointerLeave);
    updateHandleVisualState();
    setHandleDisplay();
  };

  const destroy = () => {
    activeDirection = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    root.removeEventListener("pointerenter", onRootPointerEnter);
    root.removeEventListener("pointerleave", onRootPointerLeave);
    for (const handle of handles.values()) {
      handle.remove();
    }
    handles.clear();
  };

  const setHandlesVisible = (nextVisible: boolean) => {
    visible = nextVisible;
    setHandleDisplay();
  };

  const setEnabled = (nextEnabled: boolean) => {
    enabled = nextEnabled;
  };

  return {
    setup,
    destroy,
    setHandlesVisible,
    setEnabled,
  };
}
