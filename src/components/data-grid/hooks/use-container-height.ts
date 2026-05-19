import { RefObject, useLayoutEffect, useState } from "react";

export function useContainerHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(
    function captureContainerHeight() {
      const container = ref.current;
      if (!container) return;

      let lastHeight: number | undefined;
      const observer = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect.height;
        if (lastHeight === undefined || next !== lastHeight) {
          lastHeight = next;
          setHeight(next);
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    },
    [ref],
  );

  return height;
}
