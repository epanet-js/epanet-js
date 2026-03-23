import { useMemo } from "react";
import clsx from "clsx";
import type { Projection } from "./types";

export const ProjectionResults = ({
  projections,
  selectedProjection,
  onSelect,
  emptyMessage,
}: {
  projections: Projection[];
  selectedProjection: Projection | null;
  onSelect: (projection: Projection) => void;
  emptyMessage?: string;
}) => {
  const results = useMemo(() => {
    const displayed = projections.slice(0, 8);
    if (
      selectedProjection &&
      !displayed.some((p) => p.id === selectedProjection.id)
    ) {
      return [selectedProjection, ...displayed];
    }
    return displayed;
  }, [projections, selectedProjection]);

  if (results.length === 0 && emptyMessage) {
    return (
      <div className="mt-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Matching projections
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
          {emptyMessage}
        </p>
      </div>
    );
  }

  if (results.length === 0 && !selectedProjection) return null;

  const displayResults =
    results.length > 0
      ? results
      : selectedProjection
        ? [selectedProjection]
        : [];

  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Matching projections
      </p>
      <div className="border border-gray-200 dark:border-gray-700 rounded-md">
        <ul className="space-y-0.5 p-1">
          {displayResults.map((p) => {
            const isSelected = selectedProjection?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={clsx(
                    "w-full text-left px-2 py-1.5 text-sm rounded",
                    isSelected
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : "hover:bg-purple-50 dark:hover:bg-gray-700",
                    "text-gray-800 dark:text-gray-200",
                  )}
                >
                  <span className="block">{p.name}</span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                    {p.id}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
