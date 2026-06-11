import { RefObject, useEffect, useState } from "react";

export type ScrollState = {
  hasVerticalScroll: boolean;
  hasHorizontalScroll: boolean;
  scrollbarWidth: number;
  scrollbarHeight: number;
};

const initialState: ScrollState = {
  hasVerticalScroll: false,
  hasHorizontalScroll: false,
  scrollbarWidth: 0,
  scrollbarHeight: 0,
};

export function useScrollState(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<ScrollState>(initialState);

  useEffect(
    function captureScrollState() {
      const el = ref.current;
      if (!el) return;

      const update = () => {
        const next: ScrollState = {
          hasVerticalScroll: el.scrollHeight > el.clientHeight,
          hasHorizontalScroll: el.scrollWidth > el.clientWidth,
          scrollbarWidth: el.offsetWidth - el.clientWidth - 2,
          scrollbarHeight: el.offsetHeight - el.clientHeight - 2,
        };
        // Avoid re-render loop by bailing out when nothing changed
        setState((prev) =>
          prev.hasVerticalScroll === next.hasVerticalScroll &&
          prev.hasHorizontalScroll === next.hasHorizontalScroll &&
          prev.scrollbarWidth === next.scrollbarWidth &&
          prev.scrollbarHeight === next.scrollbarHeight
            ? prev
            : next,
        );
      };

      update();
      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(el);
      return () => resizeObserver.disconnect();
    },
    [ref],
  );

  return state;
}
