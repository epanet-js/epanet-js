import { useMemo } from "react";
import clsx from "clsx";
import type { Projection } from "./types";

export const ProjectionResults = ({
  projections,
  selectedProjection,
  onSelect,
}: {
  projections: Projection[];
  selectedProjection: Projection | null;
  onSelect: (projection: Projection) => void;
}) => {
  const results = useMemo(() => {
    const dummyResults = projections.slice(0, 8);
    if (
      selectedProjection &&
      !dummyResults.some((p) => p.id === selectedProjection.id)
    ) {
      return [selectedProjection, ...dummyResults];
    }
    return dummyResults;
  }, [projections, selectedProjection]);

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
      <ul className="space-y-1 max-h-[400px] overflow-y-auto">
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
                <span className="font-medium">{p.id}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {" "}
                  — {p.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
