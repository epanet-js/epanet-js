import { useMemo } from "react";
import clsx from "clsx";
import type { Proj4Projection } from "src/lib/projections";
import { useTranslate } from "src/hooks/use-translate";
import { MapPinXInsideIcon } from "src/icons";

export const ProjectionResults = ({
  projections,
  selectedProjection,
  onSelect,
  showEmptyState,
  isLoading,
}: {
  projections: Proj4Projection[];
  selectedProjection: Proj4Projection | null;
  onSelect: (projection: Proj4Projection) => void;
  showEmptyState?: boolean;
  isLoading?: boolean;
}) => {
  const t = useTranslate();
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
          {t("networkProjection.matchingProjections")}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-700 rounded-md animate-pulse">
          {t("networkProjection.searchingProjections")}
        </p>
      </div>
    );
  }

  if (results.length === 0 && showEmptyState) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-gray-400">
          <MapPinXInsideIcon size={96} />
        </div>
        <p className="text-sm font-semibold py-4 text-gray-600 dark:text-gray-300 max-w-48">
          {t("networkProjection.noResultsTitle")}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-48">
          {t("networkProjection.noResultsDescription")}
        </p>
      </div>
    );
  }

  if (results.length === 0 && !selectedProjection) return null;

  return (
    <div className="mt-3 flex flex-col min-h-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
        {t("networkProjection.matchingProjections")} ({results.length})
      </p>
      <ul className="space-y-0.5 min-h-0 overflow-y-auto scroll-shadows">
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
  );
};
