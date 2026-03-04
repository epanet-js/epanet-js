import { useState, useMemo } from "react";
// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import { Compass, ArrowLeft, Search } from "lucide-react";
import { useProjections, type Projection } from "src/hooks/use-projections";
import epsgIndex from "epsg-index/all.json";
import type { RawCoordinate } from "./use-converter";
import type { MapBounds } from "./projection-map";

type EpsgEntry = {
  bbox: [number, number, number, number] | null; // [north, west, south, east]
};

function bboxIntersectsBounds(
  epsgBbox: [number, number, number, number],
  bounds: MapBounds,
): boolean {
  const [north, west, south, east] = epsgBbox;
  return (
    east >= bounds.west &&
    west <= bounds.east &&
    north >= bounds.south &&
    south <= bounds.north
  );
}

const MAX_SAMPLE = 15;

function projectionPlacesNodesInBounds(
  projection: Projection,
  rawCoordinates: RawCoordinate[],
  bounds: MapBounds,
): boolean {
  try {
    const converter = proj4(projection.code, "EPSG:4326");
    const sample =
      rawCoordinates.length > MAX_SAMPLE
        ? rawCoordinates
            .filter(
              (_, i) =>
                i % Math.floor(rawCoordinates.length / MAX_SAMPLE) === 0,
            )
            .slice(0, MAX_SAMPLE)
        : rawCoordinates;

    return sample.some(({ x, y }) => {
      try {
        const [lng, lat] = converter.forward([x, y]);
        return (
          isFinite(lng) &&
          isFinite(lat) &&
          lng >= bounds.west &&
          lng <= bounds.east &&
          lat >= bounds.south &&
          lat <= bounds.north
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <Compass
        size={96}
        strokeWidth={1}
        className="text-gray-300 dark:text-gray-600"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">
        Zoom in on your network's location to see available matching projections
      </p>
    </div>
  );
}

function ProjectionRow({
  projection,
  isSelected,
  onSelect,
}: {
  projection: Projection;
  isSelected: boolean;
  onSelect: (p: Projection) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(projection)}
      className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
        isSelected
          ? "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
      }`}
    >
      <span className="font-medium block">{projection.name}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {projection.id}
      </span>
    </button>
  );
}

function ManualBrowse({
  selectedProjection,
  onSelect,
  onBack,
}: {
  selectedProjection: Projection | null;
  onSelect: (p: Projection) => void;
  onBack: () => void;
}) {
  const { projections, loading } = useProjections();
  const [query, setQuery] = useState("");

  const sortedProjections = useMemo(() => {
    if (!projections) return [];
    return Array.from(projections.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [projections]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sortedProjections;
    return sortedProjections.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [sortedProjections, query]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline self-start"
      >
        <ArrowLeft size={12} />
        Back to suggestions
      </button>

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">
        All projections
      </h3>

      <input
        type="search"
        placeholder="Search all projections…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />

      <div className="flex-1 overflow-y-auto min-h-0 rounded border border-gray-200 dark:border-gray-700">
        {loading && (
          <p className="text-sm text-gray-400 p-3">Loading projections…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-gray-400 p-3">No projections found</p>
        )}
        {filtered.map((p) => (
          <ProjectionRow
            key={p.id}
            projection={p}
            isSelected={selectedProjection?.id === p.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectionList({
  zoom,
  mapBounds,
  rawCoordinates,
  selectedProjection,
  onSelect,
  onClear,
}: {
  zoom: number;
  mapBounds: MapBounds | null;
  rawCoordinates: RawCoordinate[];
  selectedProjection: Projection | null;
  onSelect: (projection: Projection) => void;
  onClear: () => void;
}) {
  const { projections, loading } = useProjections();
  const [query, setQuery] = useState("");
  const [manualMode, setManualMode] = useState(false);

  const filteredProjections = useMemo(() => {
    if (!projections) return [];

    const all = Array.from(projections.values());
    const q = query.toLowerCase();
    const queryFiltered = q
      ? all.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
        )
      : all;

    if (!mapBounds || rawCoordinates.length === 0) return [];

    const bboxCandidates = queryFiltered.filter((p) => {
      const numericCode = p.id.replace("EPSG:", "");
      const entry = (epsgIndex as unknown as Record<string, EpsgEntry>)[
        numericCode
      ];
      if (!entry?.bbox) return false;
      return bboxIntersectsBounds(entry.bbox, mapBounds);
    });

    return bboxCandidates.filter((p) =>
      projectionPlacesNodesInBounds(p, rawCoordinates, mapBounds),
    );
  }, [projections, query, mapBounds, rawCoordinates]);

  if (manualMode) {
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-2">
        <ManualBrowse
          selectedProjection={selectedProjection}
          onSelect={(p) => {
            onSelect(p);
            setManualMode(false);
          }}
          onBack={() => setManualMode(false)}
        />
      </div>
    );
  }

  const showEmptyState =
    zoom < 7 || (!loading && filteredProjections.length === 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <button
        type="button"
        onClick={() => setManualMode(true)}
        className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline self-start"
      >
        <Search size={12} />
        Want to search projections manually?
      </button>

      {selectedProjection && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
          <span className="flex-1 text-xs font-medium text-purple-700 dark:text-purple-300 truncate">
            {selectedProjection.name}
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selected projection"
            className="flex-shrink-0 text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {showEmptyState ? (
        <EmptyState />
      ) : (
        <>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">
            Suggested projections
          </h3>
          <input
            type="search"
            placeholder="Search projections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex-1 overflow-y-auto min-h-0 rounded border border-gray-200 dark:border-gray-700">
            {loading && (
              <p className="text-sm text-gray-400 p-3">Loading projections…</p>
            )}
            {filteredProjections.map((p) => (
              <ProjectionRow
                key={p.id}
                projection={p}
                isSelected={selectedProjection?.id === p.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
