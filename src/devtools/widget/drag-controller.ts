interface CreateWidgetDragControllerArgs {
  root: HTMLDivElement;
  header: HTMLDivElement;
  onViewportChange: () => void;
}

export interface WidgetDragController {
  clampIntoViewport(): void;
  setup(): void;
  destroy(): void;
}

export function createWidgetDragController({ root, header, onViewportChange }: CreateWidgetDragControllerArgs): WidgetDragController {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const clampIntoViewport = () => {
    const margin = 8;
    const rect = root.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const minLeft = margin;
    const minTop = margin;
    const maxLeft = Math.max(minLeft, viewportWidth - rect.width - margin);
    const maxTop = Math.max(minTop, viewportHeight - rect.height - margin);

    const currentLeft = Number.parseFloat(root.style.left || "0");
    const currentTop = Number.parseFloat(root.style.top || "0");

    const nextLeft = Math.min(Math.max(currentLeft, minLeft), maxLeft);
    const nextTop = Math.min(Math.max(currentTop, minTop), maxTop);

    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    root.style.left = `${event.clientX - offsetX}px`;
    root.style.top = `${event.clientY - offsetY}px`;
    clampIntoViewport();
  };

  const onPointerUp = () => {
    dragging = false;
    clampIntoViewport();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const onPointerDown = (event: PointerEvent) => {
    const targetElement = event.target as HTMLElement | null;
    if (targetElement?.closest("button")) return;

    dragging = true;
    const rect = root.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onWindowViewportChange = () => {
    clampIntoViewport();
    onViewportChange();
  };

  const setup = () => {
    header.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onWindowViewportChange);
    window.addEventListener("scroll", onWindowViewportChange, true);
    window.requestAnimationFrame(() => {
      clampIntoViewport();
    });
  };

  const destroy = () => {
    dragging = false;
    header.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("resize", onWindowViewportChange);
    window.removeEventListener("scroll", onWindowViewportChange, true);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  return {
    clampIntoViewport,
    setup,
    destroy,
  };
}
