import { useRef } from "react";
import { useMove } from "@react-aria/interactions";

const MIN_WIDTH = 150;
const MAX_WIDTH = 400;

export const PatternSidebarResizer = ({
  width,
  onWidthChange,
}: {
  width: number;
  onWidthChange: (width: number) => void;
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
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, rawWidth.current),
      );
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
      style={{ cursor: "col-resize" }}
      className="flex-shrink-0 w-3 z-10
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
