import { useMemo } from "react";
import clsx from "clsx";
import type { Projection } from "./types";

export const ProjectionResults = ({
  projections,
  selectedProjection,
  onSelect,
  emptyMessage,
  isLoading,
}: {
  projections: Projection[];
  selectedProjection: Projection | null;
  onSelect: (projection: Projection) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}) => {
  const results = useMemo(() => {
    if (
      selectedProjection &&
      !projections.some((p) => p.id === selectedProjection.id)
    ) {
      return [selectedProjection, ...projections];
    }
    return projections;
  }, [projections, selectedProjection]);

  if (isLoading) {
    return (
      <div className="mt-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Matching projections
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-700 rounded-md animate-pulse">
          Searching projections…
        </p>
      </div>
    );
  }

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

  return (
    <div className="mt-3 flex flex-col min-h-0 flex-1">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
        Matching projections ({results.length})
      </p>
      <div className="border border-gray-200 dark:border-gray-700 rounded-md min-h-0 overflow-y-auto scroll-shadows flex-1">
        <ul className="space-y-0.5 p-1">
          {results.map((p) => {
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
