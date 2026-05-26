import { RefObject, useCallback } from "react";

export function useHeaderScrollSync(
  scrollRef: RefObject<HTMLDivElement | null>,
  headerScrollRef: RefObject<HTMLDivElement | null>,
) {
  return useCallback(() => {
    if (headerScrollRef.current && scrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, [scrollRef, headerScrollRef]);
}
