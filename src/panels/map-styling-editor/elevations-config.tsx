import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";

import * as Popover from "@radix-ui/react-popover";
import { nanoid } from "nanoid";
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
  restrictToFirstScrollableAncestor,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslate } from "src/hooks/use-translate";
import { projectSettingsAtom } from "src/state/project-settings";
import { useUserTracking } from "src/infra/user-tracking";
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
import { convertTo } from "src/quantity";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import { offlineAtom } from "src/state/offline";
import { extractGeoTiffMetadata } from "src/lib/elevations";
import type {
  ElevationSource,
  GeoTiffElevationSource,
  GeoTiffTile,
  TileServerElevationSource,
} from "src/lib/elevations";
import { ActionButton } from "src/components/action-button";

export const ElevationsConfig = () => {
  const translate = useTranslate();
  const sources = useAtomValue(elevationSourcesAtom);
  const setSources = useSetAtom(elevationSourcesAtom);
  const reversedSources = [...sources].reverse();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Work on the reversed array (display order), then reverse back for storage
    const oldIndex = reversedSources.findIndex((s) => s.id === active.id);
    const newIndex = reversedSources.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(reversedSources, oldIndex, newIndex);
    setSources([...reordered].reverse());
  };

  return (
    <Section title={translate("elevations")}>
      <div className="flex flex-col gap-y-1">
        <DndContext
          onDragEnd={handleDragEnd}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[
            restrictToVerticalAxis,
            restrictToFirstScrollableAncestor,
          ]}
        >
          <SortableContext
            items={reversedSources}
            strategy={verticalListSortingStrategy}
          >
            {reversedSources.map((source) =>
              source.type === "geotiff" ? (
                <GeoTiffElevationSourceRow key={source.id} source={source} />
              ) : (
                <TileServerElevationSourceRow key={source.id} source={source} />
              ),
            )}
          </SortableContext>
        </DndContext>
        <AddElevationDataButton />
      </div>
    </Section>
  );
};

const ElevationSourceRowShell = ({
  id,
  name,
  typeLabel,
  disabled = false,
  children,
}: {
  id: string;
  name: string;
  typeLabel: string;
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
    <div
      ref={setNodeRef}
      style={style}
      className="py-2 flex gap-x-2 items-start"
    >
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
          className={`font-semibold ${disabled ? "opacity-40" : "opacity-50"}`}
          style={{ fontSize: 10 }}
        >
          {typeLabel}
        </div>
      </div>
    </div>
  );
};

const GeoTiffElevationSourceRow = ({
  source,
}: {
  source: GeoTiffElevationSource;
}) => {
  const translate = useTranslate();
  const setSources = useSetAtom(elevationSourcesAtom);
  const userTracking = useUserTracking();

  const handleDelete = () => {
    setSources((prev) => prev.filter((s) => s.id !== source.id));
    userTracking.capture({
      name: "elevationSource.deleted",
      sourceType: source.type,
    });
  };

  return (
    <ElevationSourceRowShell
      id={source.id}
      name={translate("userElevationData")}
      typeLabel="GEOTIFF"
    >
      <Popover.Root>
        <Popover.Trigger asChild>
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
            <GeoTiffTilesPopover source={source} />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <Button
        variant="quiet/mode"
        className="h-8 text-red-500"
        onClick={handleDelete}
      >
        <DeleteIcon />
      </Button>
    </ElevationSourceRowShell>
  );
};

const GeoTiffTilesPopover = ({
  source,
}: {
  source: GeoTiffElevationSource;
}) => {
  const translate = useTranslate();
  const setSources = useSetAtom(elevationSourcesAtom);
  const userTracking = useUserTracking();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTiles = async (files: File[]) => {
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const metadata = await extractGeoTiffMetadata(file);
        return { id: nanoid(), ...metadata };
      }),
    );

    const newTiles = results
      .filter(
        (r): r is PromiseFulfilledResult<GeoTiffTile> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    if (newTiles.length === 0) return;

    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id && s.type === "geotiff"
          ? { ...s, tiles: [...newTiles, ...s.tiles] }
          : s,
      ),
    );
    userTracking.capture({
      name: "elevationSource.tilesAdded",
      tileCount: newTiles.length,
    });
  };

  const handleDeleteTile = (tileId: string) => {
    setSources((prev) => {
      const updated = prev.map((s) =>
        s.id === source.id && s.type === "geotiff"
          ? { ...s, tiles: s.tiles.filter((t) => t.id !== tileId) }
          : s,
      );
      return updated.filter((s) => s.type !== "geotiff" || s.tiles.length > 0);
    });
    userTracking.capture({ name: "elevationSource.tileDeleted" });
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">
        {translate("userElevationData")}
      </div>
      <ElevationOffsetField source={source} />
      <div className="overflow-y-auto max-h-[30vh] scroll-shadows border rounded">
        <ul className="flex flex-col">
          {source.tiles.map((tile) => (
            <li
              key={tile.id}
              className="group flex items-center justify-between gap-x-2 h-8 shrink-0 px-2 even:bg-gray-100 hover:bg-purple-100"
            >
              <span className="text-sm">{tile.file.name}</span>
              <Button
                variant="quiet/mode"
                className="h-8 text-red-500"
                onClick={() => handleDeleteTile(tile.id)}
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
            void handleAddTiles(files);
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
}: {
  source: TileServerElevationSource;
}) => {
  const translate = useTranslate();
  const isOffline = useAtomValue(offlineAtom);
  const setSources = useSetAtom(elevationSourcesAtom);

  const toggleEnabled = () => {
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, enabled: !s.enabled } : s)),
    );
    return Promise.resolve();
  };

  const isDisabled = isOffline || !source.enabled;

  return (
    <ElevationSourceRowShell
      id={source.id}
      name={translate("mapboxDefaultData")}
      typeLabel={translate("globalDtm").toUpperCase()}
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
            <TileServerPopover source={source} />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <ActionButton
        action={{
          onSelect: toggleEnabled,
          applicable: true,
          disabled: isOffline,
          label: source.enabled ? translate("disable") : translate("enable"),
          icon: isDisabled ? <LocateIcon /> : <LocateOffIcon />,
        }}
      />
    </ElevationSourceRowShell>
  );
};

const TileServerPopover = ({
  source,
}: {
  source: TileServerElevationSource;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">
        {translate("mapboxDefaultData")}
      </div>
      <ElevationOffsetField source={source} />
    </div>
  );
};

const ElevationOffsetField = ({ source }: { source: ElevationSource }) => {
  const translate = useTranslate();
  const setSources = useSetAtom(elevationSourcesAtom);
  const userTracking = useUserTracking();
  const { units } = useAtomValue(projectSettingsAtom);
  const elevationUnit = units.elevation;

  const displayValue = convertTo(
    { value: source.elevationOffsetM, unit: "m" },
    elevationUnit,
  );

  const handleChange = (newValue: number) => {
    const valueInMeters = convertTo(
      { value: newValue, unit: elevationUnit },
      "m",
    );
    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id ? { ...s, elevationOffsetM: valueInMeters } : s,
      ),
    );
    userTracking.capture({
      name: "elevationSource.offsetChanged",
      sourceType: source.type,
      oldValue: source.elevationOffsetM,
      newValue: valueInMeters,
    });
  };

  const label = `${translate("projectionOffset")} (${elevationUnit})`;

  return (
    <InlineField name={label} layout="label-flex-none">
      <NumericField
        label={label}
        displayValue={localizeDecimal(displayValue)}
        onChangeValue={handleChange}
        styleOptions={{ padding: "md", textSize: "sm" }}
        tabIndex={0}
      />
    </InlineField>
  );
};

const AddElevationDataButton = () => {
  const translate = useTranslate();
  const setSources = useSetAtom(elevationSourcesAtom);
  const userTracking = useUserTracking();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const metadata = await extractGeoTiffMetadata(file);
          return { id: nanoid(), ...metadata };
        }),
      );

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
      userTracking.capture({
        name: "elevationSource.added",
        tileCount: tiles.length,
      });
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
        className="w-full justify-center"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
      >
        <AddIcon size="sm" />
        {isLoading ? translate("loading") : translate("addNewElevationData")}
      </Button>
    </>
  );
};
