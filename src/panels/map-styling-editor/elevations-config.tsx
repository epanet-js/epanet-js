import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useContext, useRef, useState } from "react";

import { LngLatBoundsLike } from "mapbox-gl";
import { nanoid } from "nanoid";
import * as Popover from "@radix-ui/react-popover";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslate } from "src/hooks/use-translate";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
  Button,
} from "src/components/elements";
import { InlineField, Section } from "src/components/form/fields";
import {
  Draggable,
  DeleteIcon,
  AddIcon,
  LocateIcon,
  LocateOffIcon,
  MultipleValuesIcon,
} from "src/icons";
import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useUserTracking } from "src/infra/user-tracking";
import { convertTo } from "src/quantity";
import { offlineAtom } from "src/state/offline";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { mapOverlayFeaturesAtom } from "src/state/map-overlay";
import {
  buildCoverageFeature,
  computeTileBoundaries,
  extractGeoTiffMetadata,
  getGeoTiffGridResolution,
  UnsupportedProjectionError,
} from "src/lib/elevations";
import { notify } from "src/components/notifications";
import type {
  BoundaryResult,
  ElevationSource,
  GetProj4Def,
  GeoTiffElevationSource,
  GeoTiffTile,
  TileServerElevationSource,
} from "src/lib/elevations";
import { MapContext } from "src/map";
import { ActionButton } from "src/components/action-button";
import { isUnprojectedAtom } from "src/state/map-projection";
import { useAuth } from "src/auth";
import { limits } from "src/user-plan";
import { dialogAtom } from "src/state/dialog";

export const ElevationsConfig = () => {
  const translate = useTranslate();
  const isUnprojected = useAtomValue(isUnprojectedAtom);

  if (isUnprojected) {
    return (
      <Section title={translate("elevations")}>
        <p className="text-sm text-gray-500">
          {translate("elevationsRequiresProjection")}
        </p>
      </Section>
    );
  }

  return <ElevationsEditor />;
};

const ElevationsEditor = () => {
  const translate = useTranslate();
  const overlay = useElevationCoverageOverlay();
  const { getProj4Def } = useProj4Definitions();
  const actions = useElevationSourceActions(
    overlay.onSourceTilesUpdated,
    getProj4Def,
  );
  const reversedSources = [...actions.sources].reverse();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = reversedSources.findIndex((s) => s.id === active.id);
    const newIndex = reversedSources.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(reversedSources, oldIndex, newIndex);
    actions.reorderSources([...reordered].reverse());
  };

  return (
    <Section title={translate("elevations")}>
      <div className="flex flex-col gap-y-1">
        <DndContext
          onDragEnd={handleDragEnd}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext
            items={reversedSources}
            strategy={verticalListSortingStrategy}
          >
            {reversedSources.map((source) =>
              source.type === "geotiff" ? (
                <GeoTiffElevationSourceRow
                  key={source.id}
                  source={source}
                  actions={actions}
                  overlay={overlay}
                />
              ) : (
                <TileServerElevationSourceRow
                  key={source.id}
                  source={source}
                  actions={actions}
                />
              ),
            )}
          </SortableContext>
        </DndContext>
      </div>
      <AddElevationDataButton actions={actions} />
    </Section>
  );
};

type Actions = ReturnType<typeof useElevationSourceActions>;
type Overlay = ReturnType<typeof useElevationCoverageOverlay>;

const ElevationSourceRowShell = ({
  id,
  name,
  description,
  disabled = false,
  children,
}: {
  id: string;
  name: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-x-2 items-start">
      <div
        className="opacity-20 hover:opacity-100 cursor-ns-resize flex items-center h-8"
        {...attributes}
        {...listeners}
      >
        <Draggable />
      </div>
      <div className="flex-auto min-w-0">
        <div className="flex gap-x-2 items-center min-w-0">
          <div
            className={`block select-none truncate flex-auto min-w-0 text-sm ${disabled ? "opacity-50" : ""}`}
          >
            {name}
          </div>
          {children}
        </div>
        <div
          className={`font-semibold text-xs text-gray-500 ${disabled ? "opacity-50" : ""}`}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

const GeoTiffElevationSourceRow = ({
  source,
  actions,
  overlay,
}: {
  source: GeoTiffElevationSource;
  actions: Actions;
  overlay: Overlay;
}) => {
  const translate = useTranslate();
  const { units } = useAtomValue(projectSettingsAtom);
  const elevationUnit = units.elevation;
  const resolutionDisplay = Math.round(
    getGeoTiffGridResolution(source, elevationUnit),
  );
  const fileCount = source.tiles.length;
  const description = `${translate("gridResolution", `${resolutionDisplay}${elevationUnit}`)} – ${translate("files", fileCount)}`;

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      overlay.showCoverage(source.id);
    } else {
      overlay.hideCoverage();
    }
  };

  return (
    <ElevationSourceRowShell
      id={source.id}
      name={translate("userElevationData")}
      description={description}
    >
      <Popover.Root onOpenChange={handlePopoverOpenChange}>
        <Popover.Trigger asChild>
          <Button
            variant="quiet/mode"
            className="h-8"
            aria-label={translate("elevationSourceDetails")}
          >
            <MultipleValuesIcon />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="left"
            align="start"
          >
            <StyledPopoverArrow />
            <GeoTiffTilesPopover
              source={source}
              actions={actions}
              overlay={overlay}
            />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <Button
        variant="quiet/mode"
        className="h-8 text-red-500"
        aria-label={translate("delete")}
        onClick={() => actions.deleteSource(source.id)}
      >
        <DeleteIcon />
      </Button>
    </ElevationSourceRowShell>
  );
};

const GeoTiffTilesPopover = ({
  source,
  actions,
  overlay,
}: {
  source: GeoTiffElevationSource;
  actions: Actions;
  overlay: Overlay;
}) => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const map = useContext(MapContext);

  const handleTileClick = (tile: GeoTiffTile) => {
    map?.map.fitBounds(tile.bbox as LngLatBoundsLike, {
      padding: 50,
      animate: true,
    });
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">
        {translate("userElevationData")}
      </div>
      <ElevationOffsetField source={source} actions={actions} />
      <div className="overflow-y-auto max-h-[30vh] scroll-shadows border rounded">
        <ul className="flex flex-col">
          {source.tiles.map((tile) => (
            <li
              key={tile.id}
              onMouseEnter={() => overlay.highlightTile(source.id, tile.id)}
              onMouseLeave={() => overlay.highlightTile(source.id, null)}
              onClick={() => handleTileClick(tile)}
              className="group flex items-center justify-between gap-x-2 h-8 shrink-0 px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="text-sm">{tile.file.name}</span>
              <Button
                variant="quiet/mode"
                className="h-8 text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.deleteTile(source.id, tile.id);
                }}
              >
                <DeleteIcon />
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".tif,.tiff"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            const files = Array.from(e.target.files);
            e.target.value = "";
            void actions.addTiles(source.id, files);
          }
        }}
      />
      <Button
        variant="default"
        size="sm"
        className="w-full justify-center"
        onClick={() => fileInputRef.current?.click()}
      >
        <AddIcon size="sm" />
        {translate("addMoreTiles")}
      </Button>
    </div>
  );
};

const TileServerElevationSourceRow = ({
  source,
  actions,
}: {
  source: TileServerElevationSource;
  actions: Actions;
}) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const isDisabled = isOffline || !source.enabled;

  return (
    <ElevationSourceRowShell
      id={source.id}
      name={translate("mapboxDefaultData")}
      description={translate("globalDtm").toUpperCase()}
      disabled={isDisabled}
    >
      <Popover.Root>
        <Popover.Trigger asChild disabled={isDisabled}>
          <Button variant="quiet/mode" className="h-8">
            <MultipleValuesIcon />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="left"
            align="start"
          >
            <StyledPopoverArrow />
            <TileServerPopover source={source} actions={actions} />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <ActionButton
        action={{
          onSelect: () => {
            actions.toggleEnabled(source.id);
            return Promise.resolve();
          },
          applicable: true,
          disabled: isOffline,
          label: source.enabled
            ? translate("disableElevationSource")
            : translate("enableElevationSource"),
          icon: isDisabled ? <LocateIcon /> : <LocateOffIcon />,
        }}
      />
    </ElevationSourceRowShell>
  );
};

const TileServerPopover = ({
  source,
  actions,
}: {
  source: TileServerElevationSource;
  actions: Actions;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">
        {translate("mapboxDefaultData")}
      </div>
      <ElevationOffsetField source={source} actions={actions} />
    </div>
  );
};

const ElevationOffsetField = ({
  source,
  actions,
}: {
  source: ElevationSource;
  actions: Actions;
}) => {
  const translate = useTranslate();
  const { units } = useAtomValue(projectSettingsAtom);
  const elevationUnit = units.elevation;

  const displayValue = convertTo(
    { value: source.elevationOffsetM, unit: "m" },
    elevationUnit,
  );

  const label = `${translate("elevationOffset")} (${elevationUnit})`;

  return (
    <InlineField name={label} layout="label-flex-none">
      <NumericField
        label={label}
        displayValue={localizeDecimal(displayValue)}
        onChangeValue={(v) => actions.updateOffset(source.id, v)}
        styleOptions={{ padding: "md", textSize: "sm" }}
        tabIndex={0}
      />
    </InlineField>
  );
};

const AddElevationDataButton = ({ actions }: { actions: Actions }) => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const handleClick = () => {
    const canUseElevations = limits.canUseElevations(user.plan);
    if (!canUseElevations) {
      userTracking.capture({
        name: "upgradeButton.clicked",
        source: "customElevations",
      });
      setDialogState({ type: "upgrade" });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    try {
      await actions.addSource(files);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".tif,.tiff"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            const files = Array.from(e.target.files);
            e.target.value = "";
            void handleFilesSelected(files);
          }
        }}
      />
      <Button
        variant="default"
        size="sm"
        className="w-full justify-center mt-2"
        onClick={handleClick}
        disabled={isLoading}
      >
        <AddIcon size="sm" />
        {isLoading ? translate("loading") : translate("addNewElevationData")}
      </Button>
    </>
  );
};

function notifyProjectionErrors(
  results: PromiseSettledResult<GeoTiffTile>[],
  translate: ReturnType<typeof useTranslate>,
) {
  const projectionErrors = results
    .filter(
      (r): r is PromiseRejectedResult =>
        r.status === "rejected" &&
        r.reason instanceof UnsupportedProjectionError,
    )
    .map((r) => r.reason as UnsupportedProjectionError);

  if (projectionErrors.length === 0) return;

  const fileNames = projectionErrors.map((e) => e.fileName).join(", ");
  const reasons = [
    ...new Set(
      projectionErrors.map((e) =>
        e.projection.isUserDefined
          ? translate("customProjection")
          : `EPSG:${e.projection.epsgCode}`,
      ),
    ),
  ].join(", ");

  notify({
    variant: "warning",
    title: translate("unsupportedProjection"),
    description: translate("unsupportedProjectionExplain", fileNames, reasons),
    id: "elevation-unsupported-projection",
  });
}

type OnSourceTilesUpdated = (
  sourceId: string,
  updatedTiles: GeoTiffTile[],
) => void;

const useElevationSourceActions = (
  onSourceTilesUpdated?: OnSourceTilesUpdated,
  getProj4Def?: GetProj4Def,
) => {
  const sources = useAtomValue(elevationSourcesAtom);
  const setSources = useSetAtom(elevationSourcesAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { units } = useAtomValue(projectSettingsAtom);
  const { startComputation, cancelTiles } =
    useComputeTileBoundaries(onSourceTilesUpdated);

  const addSource = useCallback(
    async (files: File[]) => {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const metadata = await extractGeoTiffMetadata(file, getProj4Def);
          return { id: nanoid(), ...metadata } as GeoTiffTile;
        }),
      );

      notifyProjectionErrors(results, translate);

      const tiles = results
        .filter(
          (r): r is PromiseFulfilledResult<GeoTiffTile> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);

      if (tiles.length === 0) return;

      const newSource: GeoTiffElevationSource = {
        type: "geotiff",
        id: nanoid(),
        enabled: true,
        tiles,
        elevationOffsetM: 0,
      };

      setSources((prev) => [...prev, newSource]);
      startComputation(newSource.id, tiles);
      userTracking.capture({
        name: "elevationSource.added",
        tileCount: tiles.length,
      });
    },
    [getProj4Def, setSources, startComputation, translate, userTracking],
  );

  const deleteSource = useCallback(
    (sourceId: string) => {
      const source = sources.find((s) => s.id === sourceId);
      if (source?.type === "geotiff") {
        cancelTiles(source.tiles.map((t) => t.id));
      }
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      userTracking.capture({
        name: "elevationSource.deleted",
        sourceType: source?.type ?? "unknown",
      });
    },
    [sources, setSources, cancelTiles, userTracking],
  );

  const addTiles = useCallback(
    async (sourceId: string, files: File[]) => {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const metadata = await extractGeoTiffMetadata(file, getProj4Def);
          return { id: nanoid(), ...metadata } as GeoTiffTile;
        }),
      );

      notifyProjectionErrors(results, translate);

      const newTiles = results
        .filter(
          (r): r is PromiseFulfilledResult<GeoTiffTile> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);

      if (newTiles.length === 0) return;

      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId && s.type === "geotiff"
            ? { ...s, tiles: [...newTiles, ...s.tiles] }
            : s,
        ),
      );
      startComputation(sourceId, newTiles);
      userTracking.capture({
        name: "elevationSource.tilesAdded",
        tileCount: newTiles.length,
      });
    },
    [getProj4Def, setSources, startComputation, translate, userTracking],
  );

  const deleteTile = useCallback(
    (sourceId: string, tileId: string) => {
      cancelTiles([tileId]);
      setSources((prev) => {
        const updated = prev.map((s) =>
          s.id === sourceId && s.type === "geotiff"
            ? { ...s, tiles: s.tiles.filter((t) => t.id !== tileId) }
            : s,
        );
        return updated.filter(
          (s) => s.type !== "geotiff" || s.tiles.length > 0,
        );
      });
      userTracking.capture({ name: "elevationSource.tileDeleted" });
    },
    [setSources, cancelTiles, userTracking],
  );

  const reorderSources = useCallback(
    (reordered: ElevationSource[]) => {
      setSources(reordered);
    },
    [setSources],
  );

  const toggleEnabled = useCallback(
    (sourceId: string) => {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, enabled: !s.enabled } : s,
        ),
      );
    },
    [setSources],
  );

  const updateOffset = useCallback(
    (sourceId: string, newValue: number) => {
      const source = sources.find((s) => s.id === sourceId);
      const valueInMeters = convertTo(
        { value: newValue, unit: units.elevation },
        "m",
      );
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, elevationOffsetM: valueInMeters } : s,
        ),
      );
      userTracking.capture({
        name: "elevationSource.offsetChanged",
        sourceType: source?.type ?? "unknown",
        oldValue: source?.elevationOffsetM ?? 0,
        newValue: valueInMeters,
      });
    },
    [sources, setSources, units.elevation, userTracking],
  );

  return {
    sources,
    addSource,
    deleteSource,
    addTiles,
    deleteTile,
    reorderSources,
    toggleEnabled,
    updateOffset,
  };
};

const useComputeTileBoundaries = (
  onSourceTilesUpdated?: OnSourceTilesUpdated,
) => {
  const setSources = useSetAtom(elevationSourcesAtom);
  const cancelledTilesRef = useRef(new Set<string>());
  const onSourceTilesUpdatedRef = useRef(onSourceTilesUpdated);
  onSourceTilesUpdatedRef.current = onSourceTilesUpdated;

  const startComputation = useCallback(
    (sourceId: string, tiles: GeoTiffTile[]) => {
      void computeTileBoundaries(
        tiles,
        ({ tileId, polygon }: BoundaryResult) => {
          if (!polygon) return;
          let updatedTiles: GeoTiffTile[] | undefined;
          setSources((prev: ElevationSource[]) => {
            const next = prev.map((s) =>
              s.id === sourceId && s.type === "geotiff"
                ? {
                    ...s,
                    tiles: s.tiles.map((t) =>
                      t.id === tileId ? { ...t, coveragePolygon: polygon } : t,
                    ),
                  }
                : s,
            );
            const updated = next.find(
              (s) => s.id === sourceId && s.type === "geotiff",
            );
            if (updated?.type === "geotiff") {
              updatedTiles = updated.tiles;
            }
            return next;
          });
          if (updatedTiles) {
            onSourceTilesUpdatedRef.current?.(sourceId, updatedTiles);
          }
        },
        (tileId: string) => cancelledTilesRef.current.has(tileId),
      );
    },
    [setSources],
  );

  const cancelTiles = useCallback((tileIds: string[]) => {
    for (const id of tileIds) cancelledTilesRef.current.add(id);
  }, []);

  return { startComputation, cancelTiles };
};

const useElevationCoverageOverlay = () => {
  const sources = useAtomValue(elevationSourcesAtom);
  const setCoverageFeatures = useSetAtom(mapOverlayFeaturesAtom);

  const activeSourceIdRef = useRef<string | null>(null);
  const hoveredTileIdRef = useRef<string | null>(null);

  const rebuildOverlay = useCallback(
    (tiles: GeoTiffTile[], hoveredTileId: string | null) => {
      const isHovering = hoveredTileId !== null;
      setCoverageFeatures(
        tiles.map((tile) => {
          const isHovered = tile.id === hoveredTileId;
          return buildCoverageFeature(tile, {
            isFilled: !isHovering,
            isDisabled: isHovering && !isHovered,
            showLabel: isHovered,
          });
        }),
      );
    },
    [setCoverageFeatures],
  );

  const showCoverage = useCallback(
    (sourceId: string) => {
      activeSourceIdRef.current = sourceId;
      hoveredTileIdRef.current = null;
      const source = sources.find((s) => s.id === sourceId);
      if (source?.type === "geotiff") {
        rebuildOverlay(source.tiles, null);
      }
    },
    [sources, rebuildOverlay],
  );

  const hideCoverage = useCallback(() => {
    activeSourceIdRef.current = null;
    hoveredTileIdRef.current = null;
    setCoverageFeatures([]);
  }, [setCoverageFeatures]);

  const highlightTile = useCallback(
    (sourceId: string, tileId: string | null) => {
      hoveredTileIdRef.current = tileId;
      const source = sources.find((s) => s.id === sourceId);
      if (source?.type === "geotiff") {
        rebuildOverlay(source.tiles, tileId);
      }
    },
    [sources, rebuildOverlay],
  );

  /** Pass this to useElevationSourceActions so the overlay updates when boundaries complete. */
  const onSourceTilesUpdated: OnSourceTilesUpdated = useCallback(
    (sourceId, updatedTiles) => {
      if (activeSourceIdRef.current === sourceId) {
        rebuildOverlay(updatedTiles, hoveredTileIdRef.current);
      }
    },
    [rebuildOverlay],
  );

  return {
    showCoverage,
    hideCoverage,
    highlightTile,
    onSourceTilesUpdated,
  };
};

const useProj4Definitions = () => {
  const cacheRef = useRef<Map<string, string> | null>(null);

  const getProj4Def: GetProj4Def = useCallback(
    async (epsgCode: number): Promise<string | null> => {
      if (!cacheRef.current) {
        const response = await fetch("/projections.json");
        const data: { id: string; code: string }[] = await response.json();
        cacheRef.current = new Map(data.map((p) => [p.id, p.code]));
      }
      return cacheRef.current.get(`EPSG:${epsgCode}`) ?? null;
    },
    [],
  );

  return { getProj4Def };
};
