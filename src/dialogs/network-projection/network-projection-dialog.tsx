import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BBox, FeatureCollection, Position } from "geojson";
import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "src/components/dialog";
import type { LocationData } from "src/components/form/location-search";
import { isLikelyLatLng } from "src/lib/geojson-utils/coordinate-transform";
import { MapPinnedIcon } from "src/icons";
import { MapPreview } from "./map-preview";
import { ProjectionSearch, type SearchMetadata } from "./projection-search";
import { ProjectionResults } from "./projection-results";
import { useProjections } from "src/hooks/use-projections";
import { useMapPreview } from "./use-map-preview";
import {
  buildProjectionCandidates,
  filterByViewport,
} from "./filter-projection-candidates";
import { projectGeoJson } from "./project-geojson";
import { approximateToNullIsland } from "./approximate-to-null-island";
import type { Proj4Projection, Projection } from "src/lib/projections";
import { getExtent } from "src/lib/geometry";
import {
  computeCentroid,
  transformPoint,
} from "src/lib/projections/xy-grid-transform";
import type { Bbox, ProjectionCandidate } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

const DEBOUNCE_MS = 200;

export const NetworkProjectionDialog = ({
  source,
  previewGeoJson,
  onImportWithProjection,
  filename,
  flowUnits,
  initialProjection,
}: {
  source: "import" | "map-panel";
  previewGeoJson: FeatureCollection;
  onImportWithProjection: (projection: Projection, extent?: BBox) => void;
  filename: string;
  flowUnits: string;
  initialProjection?: Proj4Projection;
}) => {
  const { closeDialog } = useDialogState();
  const { projectionsArray: projections } = useProjections();
  const { fitToNetwork, fitToBbox, setHandle } = useMapPreview();
  const userTracking = useUserTracking();
  const t = useTranslate();

  const bounds = useMemo(() => computeBounds(previewGeoJson), [previewGeoJson]);

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    null,
  );
  const [selectedProjection, setSelectedProjection] =
    useState<Proj4Projection | null>(null);
  const [visibleCandidates, setVisibleCandidates] = useState<
    ProjectionCandidate[]
  >([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [displayGeoJSON, setDisplayGeoJSON] =
    useState<FeatureCollection | null>(() => {
      if (initialProjection) {
        try {
          const projected = projectGeoJson(
            previewGeoJson,
            initialProjection.code,
          );
          if (isLikelyLatLng(projected)) return projected;
        } catch {
          // fall through
        }
      }
      if (isLikelyLatLng(previewGeoJson)) return previewGeoJson;
      return approximateToNullIsland(previewGeoJson);
    });
  const [showBasemap, setShowBasemap] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  const allCandidatesRef = useRef<ProjectionCandidate[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedLocationRef = useRef<LocationData | null>(null);
  const lastSearchRef = useRef<SearchMetadata | null>(null);

  const applyProjection = useCallback(
    (
      projection: Proj4Projection,
      options: {
        fitNetwork: boolean;
        basemap: boolean;
        onComplete?: (result: { outOfBounds: boolean }) => void;
      },
    ) => {
      if (projectTimeoutRef.current) {
        clearTimeout(projectTimeoutRef.current);
        projectTimeoutRef.current = null;
      }

      setIsProjecting(true);
      projectTimeoutRef.current = setTimeout(() => {
        let outOfBounds = false;
        try {
          const projected = projectGeoJson(previewGeoJson, projection.code);
          if (isLikelyLatLng(projected)) {
            setDisplayGeoJSON(projected);
            setShowBasemap(options.basemap);
            setProjectionError(null);
            if (options.fitNetwork) {
              fitToNetwork(projected);
            }
          } else {
            outOfBounds = true;
            const fallback = approximateToNullIsland(previewGeoJson);
            setDisplayGeoJSON(fallback);
            setShowBasemap(false);
            setProjectionError(t("networkProjection.projectionOutOfBounds"));
            fitToNetwork(fallback);
          }
        } catch {
          outOfBounds = true;
          const fallback = approximateToNullIsland(previewGeoJson);
          setDisplayGeoJSON(fallback);
          setShowBasemap(false);
          setProjectionError(t("networkProjection.projectionOutOfBounds"));
          fitToNetwork(fallback);
        }
        setIsProjecting(false);
        options.onComplete?.({ outOfBounds });
      }, 0);
    },
    [previewGeoJson, fitToNetwork, t],
  );

  const updateVisibleCandidates = useCallback(
    (bbox: Bbox, autoSelect: "first" | "keep") => {
      const visible = filterByViewport(allCandidatesRef.current, bbox);
      setVisibleCandidates(visible);

      if (visible.length > 0) {
        if (autoSelect === "first") {
          setSelectedProjection(visible[0].projection);
          applyProjection(visible[0].projection, {
            fitNetwork: true,
            basemap: true,
          });
        } else {
          setSelectedProjection((prev) => {
            const stillVisible =
              prev && visible.some((c) => c.projection.id === prev.id);
            if (stillVisible) return prev;
            const next = visible[0].projection;
            applyProjection(next, { fitNetwork: false, basemap: true });
            return next;
          });
        }
      } else {
        setSelectedProjection(null);
        setDisplayGeoJSON(null);
        setProjectionError(null);
      }
    },
    [applyProjection],
  );

  useEffect(() => {
    if (projections.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsBuilding(true);
    void buildProjectionCandidates(
      projections,
      previewGeoJson,
      controller.signal,
    ).then((candidates) => {
      if (controller.signal.aborted) return;
      allCandidatesRef.current = candidates;
      setIsBuilding(false);

      if (initialProjection) {
        setSelectedProjection(initialProjection);
        applyProjection(initialProjection, {
          fitNetwork: true,
          basemap: true,
        });
        const match = candidates.find(
          (c) => c.projection.id === initialProjection.id,
        );
        if (match) {
          updateVisibleCandidates(match.projectedBbox, "keep");
        }
      }
    });

    return () => controller.abort();
  }, [
    projections,
    previewGeoJson,
    initialProjection,
    applyProjection,
    updateVisibleCandidates,
  ]);

  const handleLocationSelect = useCallback(
    (location: LocationData) => {
      setSelectedLocation(location);
      selectedLocationRef.current = location;
      setProjectionError(null);
      setShowBasemap(true);
      fitToBbox(location.bbox);
      updateVisibleCandidates(location.bbox, "first");
    },
    [updateVisibleCandidates, fitToBbox],
  );

  const handleBoundsChange = useCallback(
    (viewportBbox: Bbox) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateVisibleCandidates(viewportBbox, "keep");
      }, DEBOUNCE_MS);
    },
    [updateVisibleCandidates],
  );

  const handleProjectionSelectFromSearch = useCallback(
    (projection: Proj4Projection) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSelectedProjection(projection);
      setSelectedLocation(null);
      selectedLocationRef.current = null;
      setVisibleCandidates([]);
      applyProjection(projection, { fitNetwork: true, basemap: true });
    },
    [applyProjection],
  );

  const handleProjectionSelectFromResults = useCallback(
    (projection: Proj4Projection) => {
      setSelectedProjection(projection);
      applyProjection(projection, {
        fitNetwork: false,
        basemap: true,
        onComplete: ({ outOfBounds }) => {
          userTracking.capture({
            name: "networkProjection.selected",
            source,
            projectionId: projection.id,
            projectionName: projection.name,
            outOfBounds,
          });
        },
      });
    },
    [applyProjection, userTracking, source],
  );

  const handleApplyBasemap = useCallback(() => {
    if (selectedProjection) {
      userTracking.capture({
        name: "networkProjection.applied",
        source,
        projectionId: selectedProjection.id,
        projectionName: selectedProjection.name,
        outOfBounds: !!projectionError,
        filename,
        flowUnits,
        bounds,
        query: lastSearchRef.current?.query ?? "",
        resultType: lastSearchRef.current?.resultType ?? "location",
      });
      const extent = displayGeoJSON
        ? getExtent(displayGeoJSON).extract()
        : undefined;
      onImportWithProjection(selectedProjection, extent);
    }
  }, [
    selectedProjection,
    onImportWithProjection,
    userTracking,
    projectionError,
    filename,
    flowUnits,
    bounds,
    displayGeoJSON,
    source,
  ]);

  const handleLoadWithoutBasemap = useCallback(() => {
    userTracking.capture({
      name: "networkProjection.skipped",
      source,
      filename,
      flowUnits,
      bounds,
    });
    const allCoords = extractCoordinates(previewGeoJson);
    const centroid = computeCentroid(allCoords);
    const projection: Projection = {
      type: "xy-grid",
      id: "xy-grid",
      name: "XY Grid",
      centroid,
    };
    const sourceExtent = getExtent(previewGeoJson, true).extract();
    const extent = sourceExtent
      ? ([
          ...transformPoint([sourceExtent[0], sourceExtent[1]], centroid),
          ...transformPoint([sourceExtent[2], sourceExtent[3]], centroid),
        ] as BBox)
      : undefined;

    onImportWithProjection(projection, extent);
  }, [
    onImportWithProjection,
    userTracking,
    filename,
    flowUnits,
    bounds,
    previewGeoJson,
    source,
  ]);

  const handleClose = useCallback(() => {
    userTracking.capture({ name: "networkProjection.closed", source });
    closeDialog();
  }, [userTracking, closeDialog, source]);

  const handleSearched = useCallback(
    (metadata: SearchMetadata) => {
      lastSearchRef.current = metadata;
      userTracking.capture({
        name: "networkProjection.searched",
        source,
        query: metadata.query,
        queryLength: metadata.query.length,
        resultType: metadata.resultType,
        resultsCount: metadata.resultsCount,
      });
    },
    [userTracking, source],
  );

  const isLoading = isBuilding || isProjecting;
  const candidateProjections = visibleCandidates.map((c) => c.projection);

  return (
    <BaseDialog
      title={t("networkProjection.title")}
      size="xxl"
      height="xxl"
      isOpen={true}
      onClose={handleClose}
      footer={
        <SimpleDialogActions
          action={t("networkProjection.applyBasemap")}
          onAction={handleApplyBasemap}
          isDisabled={!selectedProjection || !!projectionError}
          secondary={{
            action:
              source === "map-panel" && initialProjection
                ? t("networkProjection.removeBasemap")
                : t("networkProjection.loadWithoutBasemap"),
            onClick: handleLoadWithoutBasemap,
          }}
        />
      }
    >
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-shrink-0 w-[300px] border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col min-h-0">
          <ProjectionSearch
            projections={projections}
            onLocationSelect={handleLocationSelect}
            onProjectionSelect={handleProjectionSelectFromSearch}
            onSearched={handleSearched}
          />

          {selectedLocation || selectedProjection ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ProjectionResults
                projections={
                  selectedLocation || initialProjection
                    ? candidateProjections
                    : []
                }
                selectedProjection={selectedProjection}
                onSelect={handleProjectionSelectFromResults}
                isLoading={isBuilding}
                showEmptyState={!!selectedLocation || !!initialProjection}
              />
              {projectionError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 p-2 border border-red-200 dark:border-red-800 rounded-md bg-red-50 dark:bg-red-950 flex-shrink-0">
                  {projectionError}
                </p>
              )}
            </div>
          ) : (
            <ProjectionEmptyState />
          )}
        </div>
        <MapPreview
          setHandle={setHandle}
          geoJSON={displayGeoJSON}
          showBasemap={showBasemap}
          onBoundsChange={
            selectedLocation || selectedProjection
              ? handleBoundsChange
              : undefined
          }
          isLoading={isLoading}
        />
      </div>
    </BaseDialog>
  );
};

const computeBounds = (geoJson: FeatureCollection): string => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const update = (coord: Position) => {
    minX = Math.min(minX, coord[0]);
    minY = Math.min(minY, coord[1]);
    maxX = Math.max(maxX, coord[0]);
    maxY = Math.max(maxY, coord[1]);
  };

  for (const feature of geoJson.features) {
    const { geometry } = feature;
    if (geometry.type === "Point") {
      update(geometry.coordinates);
    } else if (geometry.type === "LineString") {
      geometry.coordinates.forEach(update);
    }
  }

  if (!isFinite(minX)) return "";
  return `${minX},${minY},${maxX},${maxY}`;
};

const extractCoordinates = (geoJson: FeatureCollection): Position[] => {
  const coords: Position[] = [];
  for (const feature of geoJson.features) {
    const { geometry } = feature;
    if (geometry.type === "Point") {
      coords.push(geometry.coordinates);
    } else if (geometry.type === "LineString") {
      coords.push(...geometry.coordinates);
    }
  }
  return coords;
};

const ProjectionEmptyState = () => {
  const t = useTranslate();
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-gray-400">
        <MapPinnedIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600 dark:text-gray-300 max-w-48">
        {t("networkProjection.addBasemap")}
      </p>
      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-48 space-y-2">
        <p>{t("networkProjection.searchHint")}</p>
        <p>{t("networkProjection.noProjectionHint")}</p>
      </div>
    </div>
  );
};
