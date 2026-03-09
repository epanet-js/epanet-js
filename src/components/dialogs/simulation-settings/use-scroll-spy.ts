import { useRef, useState, useCallback } from "react";

const SCROLL_PADDING = 16;
const ACTIVATION_OFFSET = 100;

// Walk back through siblings (and one level up) to find the nearest preceding
// sticky element — the subheader that will be stuck above this target.
function findPrecedingSticky(target: Element): HTMLElement | null {
  let prev = target.previousElementSibling;
  while (prev) {
    if (getComputedStyle(prev).position === "sticky")
      return prev as HTMLElement;
    prev = prev.previousElementSibling;
  }
  const parent = target.parentElement;
  if (parent) {
    prev = parent.previousElementSibling;
    while (prev) {
      if (getComputedStyle(prev).position === "sticky")
        return prev as HTMLElement;
      prev = prev.previousElementSibling;
    }
  }
  return null;
}

export const useScrollSpy = (sectionIds: string[]) => {
  const [activeSection, setActiveSection] = useState<string>(
    sectionIds[0] ?? "",
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLockedRef = useRef(false);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  // Callback ref: sets up the scroll listener the moment the DOM node mounts
  const scrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (containerRef.current && scrollHandlerRef.current) {
        containerRef.current.removeEventListener(
          "scroll",
          scrollHandlerRef.current,
        );
        scrollHandlerRef.current = null;
      }

      containerRef.current = node;
      if (!node) return;

      const updateActive = () => {
        if (isLockedRef.current) return;

        // Bottom-out override: force last section when scrolled to bottom
        const { scrollTop, scrollHeight, clientHeight } = node;
        if (scrollHeight - scrollTop - clientHeight < 1) {
          setActiveSection(sectionIds[sectionIds.length - 1] ?? "");
          return;
        }

        // Top-threshold: the last section whose top has entered the activation zone.
        // The first section stays active until the next one crosses; all others
        // activate when their top is within ACTIVATION_OFFSET of the container top,
        // i.e. once half the inter-section gap has been scrolled past.
        const containerTop = node.getBoundingClientRect().top;
        let active = sectionIds[0] ?? "";
        for (let i = 0; i < sectionIds.length; i++) {
          const el = node.querySelector(`[data-section-id="${sectionIds[i]}"]`);
          if (!el) continue;
          const offset = i === 0 ? SCROLL_PADDING : ACTIVATION_OFFSET;
          if (el.getBoundingClientRect().top - containerTop <= offset + 1) {
            active = sectionIds[i];
          }
        }
        setActiveSection(active);
      };

      const onScroll = () => updateActive();
      node.addEventListener("scroll", onScroll, { passive: true });
      scrollHandlerRef.current = onScroll;
    },
    [sectionIds],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    isLockedRef.current = true;
    setActiveSection(sectionId);

    const container = containerRef.current;
    if (!container) {
      isLockedRef.current = false;
      return;
    }

    const target = container.querySelector(`[data-section-id="${sectionId}"]`);
    if (!target) {
      isLockedRef.current = false;
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Find the nearest sticky sibling preceding the target (checking direct
    // siblings first, then the parent's siblings one level up). If found,
    // offset by its top + height so the fields land just below the stuck header.
    const precedingSticky = findPrecedingSticky(target);
    const offset = precedingSticky
      ? parseFloat(getComputedStyle(precedingSticky).top) +
        precedingSticky.getBoundingClientRect().height
      : SCROLL_PADDING;

    container.scrollTo({
      top: container.scrollTop + targetRect.top - containerRect.top - offset,
      behavior: "smooth",
    });

    // Unlock after smooth scroll finishes, preventing flicker
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      isLockedRef.current = false;
    };
    container.addEventListener("scrollend", unlock, { once: true });
    setTimeout(unlock, 1000); // Fallback if scrollend doesn't fire
  }, []);

  return { activeSection, scrollToSection, scrollContainerRef };
};
