import { useLayoutEffect, useRef, useState } from "react";
import { useMove } from "@react-aria/interactions";

const MIN_WIDTH = 150;
const MAX_WIDTH = 400;
const RESIZER_WIDTH = 12;

export const useSidebarWidth = ({
  initial,
  min = MIN_WIDTH,
  max = MAX_WIDTH,
  reserve,
}: {
  initial: number;
  min?: number;
  max?: number;
  reserve?: number;
}) => {
  const [width, setWidth] = useState(initial);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useLayoutEffect(
    function trackContainerWidth() {
      if (!container || reserve === undefined) return;
      setContainerWidth(container.clientWidth);
      const observer = new ResizeObserver(() =>
        setContainerWidth(container.clientWidth),
      );
      observer.observe(container);
      return () => observer.disconnect();
    },
    [container, reserve],
  );

  const maxWidth =
    reserve === undefined
      ? max
      : containerWidth === null
        ? width
        : Math.max(min, containerWidth - RESIZER_WIDTH - reserve);
  const shownWidth = Math.min(width, maxWidth);

  return {
    width: shownWidth,
    containerRef: setContainer,
    resizerProps: {
      width: shownWidth,
      onWidthChange: setWidth,
      minWidth: min,
      maxWidth,
    },
  };
};

export const VerticalResizer = ({
  width,
  onWidthChange,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
}: {
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}) => {
  const rawWidth = useRef<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const { moveProps } = useMove({
    onMoveStart() {
      rawWidth.current = widthRef.current;
    },
    onMove(e) {
      if (rawWidth.current === null) return;
      rawWidth.current += Math.round(e.deltaX);
      const newWidth = Math.max(minWidth, Math.min(maxWidth, rawWidth.current));
      onWidthChange(newWidth);
    },
    onMoveEnd() {
      rawWidth.current = null;
    },
  });

  return (
    <button
      {...moveProps}
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabIndex={-1}
      style={{ cursor: "col-resize", width: RESIZER_WIDTH }}
      className="shrink-0 z-10
        touch-none
        flex items-center justify-start
        group"
    >
      <div
        className="w-0.5 h-full
          bg-purple-700 dark:bg-purple-700
          opacity-0
          group-hover:opacity-100
          pointer-events-none"
      />
    </button>
  );
};
