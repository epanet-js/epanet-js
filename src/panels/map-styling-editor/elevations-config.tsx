import { useAtomValue, useSetAtom } from "jotai";
import * as Popover from "@radix-ui/react-popover";
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
  LocateOffIcon,
  MultipleValuesIcon,
} from "src/icons";
import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { convertTo } from "src/quantity";
import { elevationSourcesAtom } from "src/state/elevation-sources";
import type {
  ElevationSource,
  GeoTiffElevationSource,
  TileServerElevationSource,
} from "src/lib/elevations";

export const ElevationsConfig = () => {
  const translate = useTranslate();
  const sources = useAtomValue(elevationSourcesAtom);

  const reversedSources = [...sources].reverse();

  return (
    <Section title={translate("elevations")}>
      <div className="flex flex-col gap-y-1">
        {reversedSources.map((source) =>
          source.type === "geotiff" ? (
            <GeoTiffElevationSourceRow key={source.id} source={source} />
          ) : (
            <TileServerElevationSourceRow key={source.id} source={source} />
          ),
        )}
        <Button variant="default" size="sm" className="w-full justify-center">
          <AddIcon size="sm" />
          {translate("addNewElevationData")}
        </Button>
      </div>
    </Section>
  );
};

const ElevationSourceRowShell = ({
  name,
  typeLabel,
  children,
}: {
  name: string;
  typeLabel: string;
  children: React.ReactNode;
}) => (
  <div className="py-2 flex gap-x-2 items-start">
    <div className="pt-0.5 opacity-20 hover:opacity-100 cursor-ns-resize">
      <Draggable />
    </div>
    <div className="flex-auto">
      <div className="flex gap-x-2 items-center">
        <span className="block select-none truncate flex-auto text-sm">
          {name}
        </span>
        {children}
      </div>
      <div className="opacity-50 font-semibold" style={{ fontSize: 10 }}>
        {typeLabel}
      </div>
    </div>
  </div>
);

const GeoTiffElevationSourceRow = ({
  source,
}: {
  source: GeoTiffElevationSource;
}) => {
  const translate = useTranslate();
  return (
    <ElevationSourceRowShell
      name={translate("userElevationData")}
      typeLabel="GEOTIFF"
    >
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="opacity-30 hover:opacity-100 select-none">
            <MultipleValuesIcon />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="sm"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="left"
            align="start"
          >
            <StyledPopoverArrow />
            <GeoTiffTilesPopover source={source} />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <button className="opacity-50 hover:opacity-100 select-none text-red-500">
        <DeleteIcon />
      </button>
    </ElevationSourceRowShell>
  );
};

const GeoTiffTilesPopover = ({
  source,
}: {
  source: GeoTiffElevationSource;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">{source.name}</div>
      <ElevationOffsetField source={source} />
      <div className="flex flex-col">
        {source.tiles.map((tile) => (
          <div
            key={tile.id}
            className="flex items-center justify-between py-1 gap-x-2"
          >
            <span className="text-sm truncate">{tile.fileName}</span>
            <button className="opacity-50 hover:opacity-100 select-none text-red-500 shrink-0">
              <DeleteIcon />
            </button>
          </div>
        ))}
      </div>
      <Button variant="default" size="sm" className="w-full justify-center">
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
  return (
    <ElevationSourceRowShell
      name={source.name}
      typeLabel={translate("globalDtm").toUpperCase()}
    >
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="opacity-30 hover:opacity-100 select-none">
            <MultipleValuesIcon />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <StyledPopoverContent
            size="sm"
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="left"
            align="start"
          >
            <StyledPopoverArrow />
            <TileServerPopover source={source} />
          </StyledPopoverContent>
        </Popover.Portal>
      </Popover.Root>
      <button className="opacity-30 hover:opacity-100 select-none">
        <LocateOffIcon />
      </button>
    </ElevationSourceRowShell>
  );
};

const TileServerPopover = ({
  source,
}: {
  source: TileServerElevationSource;
}) => {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="font-semibold text-sm">{source.name}</div>
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
      name: "map.elevationOffset.changed",
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
