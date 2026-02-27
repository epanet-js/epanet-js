import { forwardRef, useCallback } from "react";
import { simulationSettingsCategories } from "./simulation-settings-data";

export const SimulationSettingsContent = forwardRef<HTMLDivElement>(
  function SimulationSettingsContent(_props, ref) {
    const measureRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
        if (!node) return;
        const updateHeight = () => {
          node.style.setProperty("--scroll-height", `${node.clientHeight}px`);
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(node);
      },
      [ref],
    );

    return (
      <div
        ref={measureRef}
        className="flex-1 min-h-0 overflow-y-auto placemark-scrollbar scroll-shadows pl-4"
      >
        <div className="flex flex-col gap-20 py-2">
          {simulationSettingsCategories.map((category) => (
            <div
              key={category.id}
              data-section-id={category.id}
              className="last:min-h-[calc(var(--scroll-height)-1rem)]"
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-white pb-3 mb-3">
                {category.label}
              </h3>
              <div className="flex flex-col gap-4">
                {category.subcategories?.map((sub) => (
                  <div
                    key={sub.id}
                    data-section-id={sub.id}
                    className="flex flex-col gap-4"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mt-2">
                      {sub.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
