import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { DataGridVariant } from "./types";

export const ROW_HEIGHT = 32; // h-8, needed for virtualizer estimateSize

export type RowsContainerState = {
  canScrollUp: boolean;
  canScrollDown: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollbarWidth: number;
  scrollbarHeight: number;
};

export type RowsContainerRef = {
  focus: () => void;
  blur: () => void;
  element: HTMLDivElement | null;
  scrollState: RowsContainerState;
};

type RowsContainerProps = {
  children: React.ReactNode;
  className?: string;
  onScrollStateChange?: (state: RowsContainerState) => void;
  variant: DataGridVariant;
  showGutter: boolean;
  showActions: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">;

export const RowsContainer = forwardRef<RowsContainerRef, RowsContainerProps>(
  function RowsContainer(
    {
      children,
      className,
      onScrollStateChange,
      variant,
      showGutter,
      showActions,
      ...props
    },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState<RowsContainerState>({
      canScrollUp: false,
      canScrollDown: false,
      canScrollLeft: false,
      canScrollRight: false,
      scrollbarWidth: 0,
      scrollbarHeight: 0,
    });

    const updateScrollState = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const newState: RowsContainerState = {
        canScrollUp: el.scrollTop > 0,
        canScrollDown: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
        canScrollLeft: el.scrollLeft > 0,
        canScrollRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
        scrollbarWidth: el.offsetWidth - el.clientWidth,
        scrollbarHeight: el.offsetHeight - el.clientHeight,
      };
      setScrollState(newState);
      onScrollStateChange?.(newState);
    }, [onScrollStateChange]);

    useEffect(
      function trackScrollState() {
        const el = scrollRef.current;
        if (!el) return;

        updateScrollState();
        el.addEventListener("scroll", updateScrollState);

        const resizeObserver = new ResizeObserver(updateScrollState);
        resizeObserver.observe(el);

        return () => {
          el.removeEventListener("scroll", updateScrollState);
          resizeObserver.disconnect();
        };
      },
      [updateScrollState],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => scrollRef.current?.focus(),
        blur: () => scrollRef.current?.blur(),
        element: scrollRef.current,
        scrollState,
      }),
      [scrollState],
    );

    const gutterWidth = showGutter ? (variant === "spreadsheet" ? 40 : 32) : 0;
    const actionsWidth = showActions ? 32 : 0;

    return (
      <>
        <div
          ref={scrollRef}
          className={clsx("outline-none overflow-auto flex-1", className)}
          {...props}
        >
          {children}
        </div>

        <ScrollShadow
          position="top"
          visible={scrollState.canScrollUp}
          topOffset={ROW_HEIGHT}
          startEdge={gutterWidth}
          endEdge={actionsWidth + scrollState.scrollbarWidth}
        />
        <ScrollShadow
          position="bottom"
          visible={scrollState.canScrollDown}
          offset={scrollState.scrollbarHeight}
          startEdge={gutterWidth}
          endEdge={actionsWidth + scrollState.scrollbarWidth}
        />
        <ScrollShadow
          position="left"
          visible={scrollState.canScrollLeft}
          topOffset={ROW_HEIGHT}
          offset={gutterWidth}
          endEdge={scrollState.scrollbarHeight}
        />
        <ScrollShadow
          position="right"
          visible={scrollState.canScrollRight}
          topOffset={ROW_HEIGHT}
          offset={actionsWidth + scrollState.scrollbarWidth}
          endEdge={scrollState.scrollbarHeight}
        />
      </>
    );
  },
);

function ScrollShadow({
  position,
  visible,
  offset = 0,
  topOffset = 0,
  startEdge = 0,
  endEdge = 0,
}: {
  position: "top" | "bottom" | "left" | "right";
  visible: boolean;
  offset?: number;
  topOffset?: number;
  startEdge?: number;
  endEdge?: number;
}) {
  if (!visible) return null;

  const isHorizontal = position === "top" || position === "bottom";

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        background: gradients[position],
        ...(isHorizontal
          ? { height: 10, left: startEdge, right: endEdge }
          : { width: 10, top: topOffset, bottom: endEdge }),
        ...(position === "top" && { top: topOffset }),
        ...(position === "bottom" && { bottom: offset }),
        ...(position === "left" && { left: offset }),
        ...(position === "right" && { right: offset }),
      }}
    />
  );
}

const gradients = {
  top: "radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent)",
  bottom:
    "radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent)",
  left: "radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.12), transparent)",
  right:
    "radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.12), transparent)",
};
