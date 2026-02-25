import { useRef, useState, useCallback } from "react";

export const useScrollSpy = (sectionIds: string[]) => {
  const [activeSection, setActiveSection] = useState<string>(
    sectionIds[0] ?? "",
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef(new Map<string, number>());
  const isLockedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  // Callback ref: sets up the IntersectionObserver the moment the DOM node mounts
  const scrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup previous observer and scroll listener
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (containerRef.current && scrollHandlerRef.current) {
        containerRef.current.removeEventListener(
          "scroll",
          scrollHandlerRef.current,
        );
        scrollHandlerRef.current = null;
      }

      containerRef.current = node;
      if (!node) return;

      ratiosRef.current.clear();

      const updateActive = () => {
        if (isLockedRef.current) return;

        // Bottom-out override: force last section when scrolled to bottom
        const { scrollTop, scrollHeight, clientHeight } = node;
        if (scrollHeight - scrollTop - clientHeight < 1) {
          setActiveSection(sectionIds[sectionIds.length - 1] ?? "");
          return;
        }

        // Most visible: pick the section with the highest intersection ratio
        let bestId = sectionIds[0] ?? "";
        let bestRatio = -1;
        for (const id of sectionIds) {
          const ratio = ratiosRef.current.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        setActiveSection(bestId);
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.sectionId;
            if (id) {
              ratiosRef.current.set(id, entry.intersectionRatio);
            }
          }
          updateActive();
        },
        {
          root: node,
          threshold: [0, 0.25, 0.5, 0.75, 1.0],
        },
      );

      for (const id of sectionIds) {
        const el = node.querySelector(`[data-section-id="${id}"]`);
        if (el) observer.observe(el);
      }

      observerRef.current = observer;

      // Lightweight scroll listener for bottom-out detection
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
    const padding = 16;
    container.scrollTo({
      top: container.scrollTop + targetRect.top - containerRect.top - padding,
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
