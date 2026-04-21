import debounce from "lodash/debounce";
import * as T from "@radix-ui/react-tooltip";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { layerConfigAtom } from "src/state/map";
import * as E from "src/components/elements";
import { Button } from "src/components/elements";
import * as P from "@radix-ui/react-popover";
import { basemaps } from "src/map/basemaps";
import { DefaultLayerItem } from "./default-layer-item";
import { newFeatureId } from "src/lib/id";
import { Form, FORM_ERROR } from "src/core/components/Form";
import { LabeledTextField } from "src/core/components/LabeledTextField";
import { TextWell } from "src/components/elements";
import { ILayerConfig, zLayerConfig } from "src/types";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import { ZodError, z } from "zod";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";
import { useQuery } from "@tanstack/react-query";
import { ReactNode, Suspense, useCallback, useRef, useState } from "react";
import { match } from "ts-pattern";
import { getTileJSON, get, getMapboxLayerURL } from "src/lib/utils";
import clamp from "lodash/clamp";
import {
  maybeDeleteOldMapboxLayer,
  useLayerConfigState,
} from "src/map/layer-config";
import { Selector } from "src/components/form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";
import { zTileJSON } from "src/lib/tile-json";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useProjections } from "src/hooks/use-projections";
import {
  parseGeoJsonFile,
  GisParseError,
} from "src/lib/gis-import/parse-geojson-file";
import { groupShapefileBundles } from "src/lib/gis-import/group-shapefile-bundles";
import { parseShapefile } from "src/lib/gis-import/parse-shapefile";
import { gisDataAtom } from "src/state/gis-data";
import { ColorPopover } from "src/components/color-popover";
import { NumericField } from "src/components/form/numeric-field";
import { Checkbox } from "src/components/form/Checkbox";
import { InlineField } from "src/components/form/fields";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Draggable,
  AddIcon,
  SettingsIcon,
  DeleteIcon,
  WarningIcon,
} from "src/icons";

type Mode =
  | "custom"
  | "basemap"
  | "custom-xyz"
  | "custom-mapbox"
  | "custom-tilejson"
  | "custom-gis";

const layerModeAtom = atom<Mode>("custom");

const SHARED_INTIAL_VALUES = {
  at: "a0",
  id: "",
  name: "",
  url: "",
  token: "",
  visibility: true,
  labelVisibility: true,
  tms: false,
  opacity: 1,
  sourceMaxZoom: {},
} as const;

/**
 * LayersPopover
 * --> AddLayer
 * ----> DefaultLayerItem
 * ----> XYZLayer
 * ----> MapboxLayer
 * ------> MapboxLayerList
 * --------> DefaultLayerItem
 */

/**
 * Layers with lower ats stack on top,
 * so this finds the lowest at possible.
 */
function getNextAt(items: ILayerConfig[]) {
  if (!items.length) {
    return generateKeyBetween(null, null);
  }
  return generateKeyBetween(null, items[0].at || null);
}

const MapboxStyleSkeleton = z.object({
  version: z.number(),
  name: z.string(),
});

function BackButton({ to }: { to: Mode }) {
  const translate = useTranslate();
  const setMode = useSetAtom(layerModeAtom);
  return (
    <E.Button
      type="button"
      size="xs"
      onClick={() => {
        setMode(to);
      }}
    >
      <ChevronLeftIcon />
      {translate("back")}
    </E.Button>
  );
}

function LayerFormHeader({
  isEditing,
  children,
}: React.PropsWithChildren<{
  isEditing?: boolean;
}>) {
  const translate = useTranslate();
  return (
    <div className="flex justify-between items-center pb-2">
      <div className="font-bold">{children}</div>
      {isEditing ? (
        <P.Close asChild>
          <E.Button type="button" size="xs">
            {translate("dialog.cancel")}
          </E.Button>
        </P.Close>
      ) : (
        <BackButton to="custom" />
      )}
    </div>
  );
}

function MapboxLayer({
  layer,
  onDone,
}: {
  layer?: z.infer<typeof zLayerConfig>;
  onDone?: () => void;
}) {
  const translate = useTranslate();
  const setMode = useSetAtom(layerModeAtom);
  const { applyChanges } = useLayerConfigState();
  const isEditing = !!layer;
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const userTracking = useUserTracking();

  const initialValues =
    layer ||
    ({
      ...SHARED_INTIAL_VALUES,
      type: "MAPBOX",
      isBasemap: false,
    } as const);

  const handleSubmit = async (values: ILayerConfig) => {
    const url = getMapboxLayerURL(values);
    let name = "";
    try {
      const style = await get(url, MapboxStyleSkeleton);
      name = style.name || "Mapbox style";
    } catch (e) {
      return {
        [FORM_ERROR]: "Could not load style",
      };
    }
    const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
      maybeDeleteOldMapboxLayer(items);
    userTracking.capture({ name: "customLayer.added", type: "MAPBOX" });
    applyChanges({
      deleteLayerConfigs,
      putLayerConfigs: [
        {
          ...values,
          name,
          visibility: true,
          labelVisibility: oldMapboxLayer
            ? oldMapboxLayer.labelVisibility
            : true,
          tms: false,
          opacity: 1,
          at: oldAt || getNextAt(items),
          id: newFeatureId(),
        },
      ],
    });

    setMode("custom");
    if (onDone) {
      onDone();
    }
  };

  return (
    <Form
      schema={zLayerConfig}
      initialValues={initialValues}
      submitText={
        isEditing
          ? translate("customLayers.updateLayer")
          : translate("customLayers.addLayer")
      }
      fullWidthSubmit
      onSubmit={handleSubmit}
    >
      <LayerFormHeader isEditing={isEditing}>Mapbox</LayerFormHeader>
      <TextWell variant="primary" size="xs">
        {translate("customLayers.checkMapboxDocs")}{" "}
        <a
          target="_blank"
          rel="noreferrer"
          className={E.styledInlineA}
          href="https://docs.mapbox.com/help/glossary/style-url/"
        >
          {translate("here")}
        </a>
        .
      </TextWell>
      <LabeledTextField
        name="url"
        label="URL"
        required
        autoComplete="off"
        placeholder="mapbox://"
      />
      <LabeledTextField
        name="token"
        required
        label={translate("accessToken")}
        autoComplete="off"
        placeholder="pk.…"
      />
    </Form>
  );
}

function TileJSONLayer({
  layer,
  onDone,
}: {
  layer?: z.infer<typeof zLayerConfig>;
  onDone?: () => void;
}) {
  const translate = useTranslate();
  const setMode = useSetAtom(layerModeAtom);
  const { applyChanges } = useLayerConfigState();
  const isEditing = !!layer;
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const userTracking = useUserTracking();
  const shouldSkipValidation = useFeatureFlag("FLAG_SKIP_LAYER_VALIDATION");

  const initialValues =
    layer ||
    ({
      ...SHARED_INTIAL_VALUES,
      type: "TILEJSON",
      isBasemap: false,
    } as const);

  return (
    <Form
      schema={zLayerConfig}
      initialValues={initialValues}
      submitText={
        isEditing
          ? translate("customLayers.updateLayer")
          : translate("customLayers.addLayer")
      }
      fullWidthSubmit
      onSubmit={async (values) => {
        try {
          if (!shouldSkipValidation && values.type === "TILEJSON")
            await get(values.url, zTileJSON);
        } catch (e) {
          if (e instanceof ZodError) {
            return {
              [FORM_ERROR]:
                "Invalid response: this endpoint does not produce valid TileJSON.",
            };
          }
          return {
            [FORM_ERROR]: "Invalid: this TileJSON can’t be downloaded.",
          };
        }
        userTracking.capture({ name: "customLayer.added", type: "TILEJSON" });
        applyChanges({
          putLayerConfigs: [
            {
              ...values,
              at: layer?.at || getNextAt(items),
              id: values.id || newFeatureId(),
            },
          ],
        });
        setMode("custom");
        if (onDone) {
          onDone();
        }
      }}
    >
      <LayerFormHeader isEditing={isEditing}>TileJSON</LayerFormHeader>
      <TextWell variant="primary" size="xs">
        {translate("customLayers.supports")}{" "}
        <a
          target="_blank"
          rel="noreferrer"
          className={E.styledInlineA}
          href="https://github.com/mapbox/tilejson-spec"
        >
          TileJSON
        </a>
        .
      </TextWell>

      <LabeledTextField
        name="name"
        label={translate("name")}
        required
        autoComplete="off"
        placeholder=""
      />
      <LabeledTextField
        name="url"
        required
        label="URL"
        autoComplete="off"
        placeholder="https://…"
      />
    </Form>
  );
}

function XYZLayer({
  layer,
  onDone,
}: {
  layer?: z.infer<typeof zLayerConfig>;
  onDone?: () => void;
}) {
  const translate = useTranslate();
  const setMode = useSetAtom(layerModeAtom);
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const isEditing = !!layer;

  const initialValues =
    layer ||
    ({
      ...SHARED_INTIAL_VALUES,
      type: "XYZ",
      isBasemap: false,
    } as const);

  return (
    <Form
      schema={zLayerConfig}
      initialValues={initialValues}
      submitText={
        isEditing
          ? translate("customLayers.updateLayer")
          : translate("customLayers.addLayer")
      }
      fullWidthSubmit
      onSubmit={(values) => {
        userTracking.capture({
          name: "customLayer.added",
          type: "XYZ",
        });
        applyChanges({
          putLayerConfigs: [
            {
              ...values,
              at: layer?.at || getNextAt(items),
              id: values.id || newFeatureId(),
            },
          ],
        });

        setMode("custom");
        if (onDone) {
          onDone();
        }
        return Promise.resolve();
      }}
    >
      <LayerFormHeader isEditing={isEditing}>XYZ</LayerFormHeader>

      <TextWell variant="primary" size="xs">
        {translate("customLayers.supports")}{" "}
        <a
          target="_blank"
          rel="noreferrer"
          className={E.styledInlineA}
          href="https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames"
        >
          slippy map tiles
        </a>
        .
      </TextWell>

      <LabeledTextField
        name="name"
        label={translate("name")}
        autoComplete="off"
        required
        placeholder=""
      />
      <LabeledTextField
        name="url"
        label="URL"
        autoComplete="off"
        required
        type="url"
        placeholder="https://…"
      />
      <TextWell>{translate("customLayers.xyzURLContain")}</TextWell>
      <label className="flex items-center gap-x-2 text-sm py-2">
        <E.FieldCheckbox name="tms" type="checkbox" /> TMS
      </label>
    </Form>
  );
}

export function AddLayer() {
  const translate = useTranslate();
  const [isOpen, setOpen] = useState<boolean>(false);
  const [mode, setMode] = useAtom(layerModeAtom);
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const { canAddCustomLayers } = usePermissions();

  const isCustomLayersPaywallOn = useFeatureFlag("FLAG_CUSTOM_LAYERS_PAYWALL");
  const isGisLayersOn = useFeatureFlag("FLAG_CUSTOM_GIS_LAYERS");

  const { applyChanges } = useLayerConfigState();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const setGisData = useSetAtom(gisDataAtom);
  const { projections } = useProjections();
  const gisFileInputRef = useRef<HTMLInputElement>(null);
  const [gisLoading, setGisLoading] = useState(false);

  const handleGisButtonClick = () => {
    userTracking.capture({ name: "layerType.choosen", type: "GEOJSON" });
    gisFileInputRef.current?.click();
  };

  const handleGisFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setGisLoading(true);

    const items = [...layerConfigs.values()];
    const { shapefileBundles, geojsonFiles } = groupShapefileBundles(files);
    const settled = await Promise.allSettled([
      ...geojsonFiles.map((file) => parseGeoJsonFile(file, projections)),
      ...shapefileBundles.map((bundle) => parseShapefile(bundle.files)),
    ]);

    setGisLoading(false);

    // Reset so the same file(s) can be re-selected
    e.target.value = "";

    const failures = settled.flatMap((r) =>
      r.status === "rejected" && r.reason instanceof GisParseError
        ? [{ fileName: r.reason.fileName, error: r.reason.code }]
        : [],
    );
    if (failures.length) {
      setDialogState({
        type: "gisImportErrors",
        totalCount: settled.length,
        errors: failures,
      });
    }

    const successes = settled.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    if (!successes.length) return;

    const mergedFeatures = successes.flatMap(
      (r) => r.featureCollection.features,
    );
    const name = successes[0].name;

    const layerId = newFeatureId();
    setGisData((prev) => {
      const next = new Map(prev);
      next.set(layerId, {
        type: "FeatureCollection",
        features: mergedFeatures,
      });
      return next;
    });

    userTracking.capture({
      name: "customLayer.added",
      type: "GEOJSON",
      filesCount: settled.length,
      processedCount: successes.length,
      featureCount: mergedFeatures.length,
      issues: [...new Set(failures.map((f) => f.error))],
    });
    applyChanges({
      putLayerConfigs: [
        {
          type: "GEOJSON",
          id: layerId,
          at: getNextAt(items),
          name,
          opacity: 1,
          visibility: true,
          labelVisibility: true,
          tms: false,
          isBasemap: false,
          sourceMaxZoom: {},
          color: "#3b82f6",
          lineWidth: 1.5,
        },
      ],
    });

    setOpen(false);
    setMode("custom");
  };

  const handleUpgrade = () => {
    setOpen(false);
    if (isCustomLayersPaywallOn) {
      setDialogState({ type: "featurePaywall", feature: "customLayers" });
    } else {
      userTracking.capture({
        name: "upgradeButton.clicked",
        source: "customLayers",
      });
      setDialogState({ type: "upgrade" });
    }
  };

  const handleModeChange = (mode: Mode, type: string) => {
    userTracking.capture({
      name: "layerType.choosen",
      type: type,
    });
    setMode(mode);
  };

  return (
    <P.Root
      open={isOpen}
      onOpenChange={(val) => {
        setOpen(val);
        setMode("custom");
      }}
    >
      <P.Trigger asChild>
        <E.Button
          aria-label={translate("customLayers.addCustom")}
          size="sm"
          className="w-full justify-center mt-2"
          onClick={() => {
            userTracking.capture({ name: "addCustomLayer.clicked" });
          }}
        >
          <AddIcon size="sm" />
          {translate("customLayers.addCustom")}
        </E.Button>
      </P.Trigger>

      <P.Portal>
        <E.StyledPopoverContent
          flush="yes"
          size="sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <E.StyledPopoverArrow />
          <Suspense fallback={<E.Loading />}>
            {match(mode)
              .with("custom", () => (
                <div className="p-3">
                  <div className="flex justify-between items-center pb-3">
                    <div className="font-bold">
                      {translate("customLayers.chooseType")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1">
                      {translate("customLayers.webServices")}
                    </div>
                    <div className="space-y-2 grid grid-cols-1">
                      <LayerTypeButton
                        type="BASEMAP"
                        mode="basemap"
                        needsUpgrade={false}
                        onModeChange={handleModeChange}
                        onUpgrade={handleUpgrade}
                      >
                        {translate("basemap")}
                      </LayerTypeButton>
                      <LayerTypeButton
                        type="XYZ"
                        mode="custom-xyz"
                        needsUpgrade={!canAddCustomLayers}
                        onModeChange={handleModeChange}
                        onUpgrade={handleUpgrade}
                      >
                        XYZ
                      </LayerTypeButton>
                      <LayerTypeButton
                        type="MAPBOX"
                        mode="custom-mapbox"
                        needsUpgrade={!canAddCustomLayers}
                        onModeChange={handleModeChange}
                        onUpgrade={handleUpgrade}
                      >
                        Mapbox
                      </LayerTypeButton>
                      <LayerTypeButton
                        type="TILEJSON"
                        mode="custom-tilejson"
                        needsUpgrade={!canAddCustomLayers}
                        onModeChange={handleModeChange}
                        onUpgrade={handleUpgrade}
                      >
                        TileJSON
                      </LayerTypeButton>
                    </div>
                    {isGisLayersOn && (
                      <>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 pt-3">
                          {translate("customLayers.localData")}
                        </div>
                        <div className="space-y-2 grid grid-cols-1">
                          <LayerTypeButton
                            type="GEOJSON"
                            mode="custom-gis"
                            needsUpgrade={!canAddCustomLayers}
                            onModeChange={handleGisButtonClick}
                            onUpgrade={handleUpgrade}
                          >
                            {translate("customLayers.vectorFile")}
                          </LayerTypeButton>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
              .with("basemap", () => (
                <div className="p-3">
                  <div className="pb-1">
                    <LayerFormHeader>{translate("basemap")}</LayerFormHeader>
                  </div>
                  <div className="space-y-2">
                    <BaseMapOptions onDone={() => setOpen(false)} />
                  </div>
                </div>
              ))
              .with("custom-xyz", () => (
                <div className="p-3">
                  <XYZLayer onDone={() => setOpen(false)} />
                </div>
              ))
              .with("custom-mapbox", () => (
                <div className="p-3">
                  <MapboxLayer onDone={() => setOpen(false)} />
                </div>
              ))
              .with("custom-tilejson", () => (
                <div className="p-3">
                  <TileJSONLayer onDone={() => setOpen(false)} />
                </div>
              ))
              .with("custom-gis", () => (
                <div className="p-3 space-y-3">
                  <LayerFormHeader>
                    {translate("customLayers.vectorFile")}
                  </LayerFormHeader>
                  {gisLoading && (
                    <E.TextWell size="xs">{translate("loading")}</E.TextWell>
                  )}
                </div>
              ))
              .exhaustive()}
          </Suspense>
        </E.StyledPopoverContent>
      </P.Portal>
      <input
        ref={gisFileInputRef}
        type="file"
        accept=".geojson,.json,.shp,.dbf,.prj,.shx,.cpg"
        multiple
        className="hidden"
        onChange={(e) => void handleGisFileChange(e)}
      />
    </P.Root>
  );
}

const BaseMapOptions = ({ onDone }: { onDone?: () => void }) => {
  const userTracking = useUserTracking();
  const { applyChanges } = useLayerConfigState();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const nextAt = getNextAt(items);

  return (
    <>
      {Object.entries(basemaps).map(([id, mapboxLayer]) => (
        <DefaultLayerItem
          key={id}
          mapboxLayer={mapboxLayer}
          onSelect={(layer) => {
            const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
              maybeDeleteOldMapboxLayer(items);
            userTracking.capture({
              name: "baseMap.changed",
              newBasemap: layer.name,
              oldBasemap: oldMapboxLayer ? oldMapboxLayer.name : "",
              source: "popover",
            });

            applyChanges({
              deleteLayerConfigs,
              putLayerConfigs: [
                {
                  ...layer,
                  visibility: true,
                  tms: false,
                  opacity: mapboxLayer.opacity,
                  at: oldAt || nextAt,
                  id: newFeatureId(),
                  labelVisibility: oldMapboxLayer
                    ? oldMapboxLayer.labelVisibility
                    : true,
                } as ILayerConfig,
              ],
            });
            onDone && onDone();
          }}
        />
      ))}
    </>
  );
};

const OpacitySetting = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  const [value, setValue] = useState<number>(
    Math.round(layerConfig.opacity * 100),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSubmit = useCallback(
    debounce((newValue: number) => {
      userTracking.capture({
        name: "layerOpacity.changed",
        newValue,
        oldValue: layerConfig.opacity,
        type: layerConfig.type,
      });
      applyChanges({
        putLayerConfigs: [
          {
            ...layerConfig,
            opacity: newValue,
          },
        ],
      });
    }, 300),
    [layerConfig],
  );

  return (
    <div className="flex items-center gap-x-1">
      <input
        type="number"
        min="0"
        step="1"
        className="text-xs
          px-1 py-0.5
          border-gray-300
          rounded-sm
          dark:text-white
          dark:bg-transparent
        opacity-50 hover:opacity-100 focus:opacity-100
        w-12"
        max="100"
        value={value}
        onChange={(e) => {
          if (e.target.valueAsNumber > 100) return;

          setValue(e.target.valueAsNumber);

          const opacity = clamp(e.target.valueAsNumber / 100, 0, 1);
          if (isNaN(opacity)) return;

          debouncedSubmit(opacity);
        }}
      />
      <div className="text-gray-500 text-xs">%</div>
    </div>
  );
};

const VisibilityToggle = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const translate = useTranslate();
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <Button
      variant="quiet/mode"
      className="h-8"
      aria-label={translate("customLayers.toggleVisibility")}
      onClick={() => {
        const isVisible = !layerConfig.visibility;
        userTracking.capture({
          name: "layerVisibility.changed",
          visible: isVisible,
          type: layerConfig.type,
        });
        applyChanges({
          putLayerConfigs: [
            {
              ...layerConfig,
              visibility: !layerConfig.visibility,
            },
          ],
        });
      }}
    >
      <E.VisibilityToggleIcon visibility={layerConfig.visibility} />
    </Button>
  );
};

const LabelsToggle = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const translate = useTranslate();
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <Button
      variant="quiet/mode"
      className="h-8"
      aria-label={translate("customLayers.toggleLabelsVisibility")}
      onClick={() => {
        const isVisible = !layerConfig.labelVisibility;
        userTracking.capture({
          name: "layerLabelVisibility.changed",
          visible: isVisible,
          type: layerConfig.type,
        });

        applyChanges({
          putLayerConfigs: [
            {
              ...layerConfig,
              labelVisibility: isVisible,
            },
          ],
        });
      }}
    >
      <E.LabelToggleIcon visibility={layerConfig.labelVisibility} />
    </Button>
  );
};

const BaseMapItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const translate = useTranslate();
  const isRaster = layerConfig.name.includes("Satellite");
  const { applyChanges } = useLayerConfigState();
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const nextAt = getNextAt(items);
  const userTracking = useUserTracking();

  const namePopover = (
    <div className="flex items-center justify-start  gap-x-2 cursor-pointer">
      <span className="select-none truncate text-sm w-auto">
        <Selector
          ariaLabel="basemaps"
          options={Object.entries(basemaps).map(([, mapboxLayer]) => ({
            value: mapboxLayer.name,
            label: mapboxLayer.name,
          }))}
          selected={layerConfig.name}
          onChange={(name) => {
            const newMapboxLayer = Object.values(basemaps).find(
              (l) => l.name === name,
            );
            if (!newMapboxLayer) return;

            const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
              maybeDeleteOldMapboxLayer(items);
            userTracking.capture({
              name: "baseMap.changed",
              newBasemap: name,
              oldBasemap: oldMapboxLayer ? oldMapboxLayer.name : "",
              source: "dropdown",
            });
            applyChanges({
              deleteLayerConfigs,
              putLayerConfigs: [
                {
                  ...newMapboxLayer,
                  visibility: true,
                  tms: false,
                  opacity: newMapboxLayer.opacity,
                  at: oldAt || nextAt,
                  id: newFeatureId(),
                  labelVisibility: layerConfig
                    ? layerConfig.labelVisibility
                    : true,
                },
              ],
            });
          }}
          styleOptions={{
            border: false,
            paddingX: 0,
            paddingY: 0,
            textSize: "text-sm",
          }}
        />
      </span>
    </div>
  );

  return (
    <LayerConfigItem typeLabel={translate("basemap").toUpperCase()}>
      <div className="block flex-auto">
        <div className="w-auto max-w-fit">{namePopover}</div>
      </div>
      {isRaster && <OpacitySetting layerConfig={layerConfig} />}
      <VisibilityToggle layerConfig={layerConfig} />
      <LabelsToggle layerConfig={layerConfig} />
    </LayerConfigItem>
  );
};

const MapboxItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const [isEditing, setEditing] = useState<boolean>(false);
  const isRaster = layerConfig.name.includes("Satellite");

  const editPopover = (
    <P.Root open={isEditing} onOpenChange={(val) => setEditing(val)}>
      <P.Trigger asChild>
        <Button variant="quiet/mode" className="h-8" aria-label="Edit">
          <SettingsIcon />
        </Button>
      </P.Trigger>
      <E.StyledPopoverContent>
        <E.StyledPopoverArrow />
        <MapboxLayer layer={layerConfig} onDone={() => setEditing(false)} />
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <div className="flex-auto min-w-0">
      <div className="flex items-center min-w-0">
        <span className="block select-none truncate flex-auto min-w-0 text-sm">
          {layerConfig.name}
        </span>
        {editPopover}
        {isRaster && <OpacitySetting layerConfig={layerConfig} />}
        <VisibilityToggle layerConfig={layerConfig} />
        <LabelsToggle layerConfig={layerConfig} />
        <DeleteLayerButton layerConfig={layerConfig} />
      </div>
      <div className="font-semibold text-xs text-gray-500">MAPBOX</div>
    </div>
  );
};

const DeleteLayerButton = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const translate = useTranslate();
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <Button
      variant="quiet/mode"
      className="h-8 text-red-500"
      aria-label={translate("delete")}
      onClick={() => {
        userTracking.capture({ name: "layer.removed", type: layerConfig.type });
        applyChanges({
          deleteLayerConfigs: [layerConfig.id],
        });
      }}
    >
      <DeleteIcon />
    </Button>
  );
};

const XYZItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const [isEditing, setEditing] = useState<boolean>(false);

  const editPopover = (
    <P.Root open={isEditing} onOpenChange={(val) => setEditing(val)}>
      <P.Trigger asChild>
        <Button variant="quiet/mode" className="h-8" aria-label="Edit">
          <SettingsIcon />
        </Button>
      </P.Trigger>
      <E.StyledPopoverContent>
        <E.StyledPopoverArrow />
        <XYZLayer layer={layerConfig} onDone={() => setEditing(false)} />
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <LayerConfigItem typeLabel="XYZ">
      <span className="block select-none truncate flex-auto text-sm">
        {layerConfig.name}
      </span>

      {editPopover}
      <OpacitySetting layerConfig={layerConfig} />
      <VisibilityToggle layerConfig={layerConfig} />
      <DeleteLayerButton layerConfig={layerConfig} />
    </LayerConfigItem>
  );
};

const TileJSONItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const [isEditing, setEditing] = useState<boolean>(false);
  const url = layerConfig.type === "TILEJSON" ? layerConfig.url : "";
  const { isError } = useQuery({
    queryKey: [url],
    queryFn: async () =>
      layerConfig.type === "TILEJSON" && getTileJSON(layerConfig.url),
    retry: false,
  });

  const editPopover = (
    <P.Root open={isEditing} onOpenChange={(val) => setEditing(val)}>
      <P.Trigger asChild>
        <Button variant="quiet/mode" className="h-8" aria-label="Edit">
          <SettingsIcon />
        </Button>
      </P.Trigger>
      <E.StyledPopoverContent>
        <E.StyledPopoverArrow />
        <TileJSONLayer layer={layerConfig} onDone={() => setEditing(false)} />
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <LayerConfigItem typeLabel="TILEJSON">
      <span className="block select-none truncate flex-auto text-sm">
        {layerConfig.name}
      </span>
      {isError ? (
        <T.Root delayDuration={0}>
          <T.Trigger>
            <WarningIcon className="text-red-500 dark:text-red-300" />
          </T.Trigger>
          <E.TContent>This TileJSON source failed to load</E.TContent>
        </T.Root>
      ) : null}
      {editPopover}
      <OpacitySetting layerConfig={layerConfig} />
      <VisibilityToggle layerConfig={layerConfig} />
      <DeleteLayerButton layerConfig={layerConfig} />
    </LayerConfigItem>
  );
};

const LayerConfigItem = ({
  typeLabel,
  children,
}: {
  typeLabel: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex-auto min-w-0">
      <div className="flex items-center min-w-0">{children}</div>
      <div className="font-semibold text-xs text-gray-500">{typeLabel}</div>
    </div>
  );
};

const VectorFileItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const translate = useTranslate();
  const { applyChanges } = useLayerConfigState();
  const setGisData = useSetAtom(gisDataAtom);
  const [isEditing, setEditing] = useState(false);
  const [editName, setEditName] = useState(layerConfig.name);

  const handleOpenChange = (open: boolean) => {
    if (open) setEditName(layerConfig.name);
    setEditing(open);
  };

  const handleNameCommit = () => {
    if (editName.trim()) {
      applyChanges({
        putLayerConfigs: [
          { ...layerConfig, name: editName.trim() } as ILayerConfig,
        ],
      });
    } else {
      setEditName(layerConfig.name);
    }
  };

  const handleDelete = () => {
    setGisData((prev) => {
      const next = new Map(prev);
      next.delete(layerConfig.id);
      return next;
    });
    applyChanges({ deleteLayerConfigs: [layerConfig.id] });
  };

  const settingsPopover = (
    <P.Root open={isEditing} onOpenChange={handleOpenChange}>
      <P.Trigger asChild>
        <Button variant="quiet/mode" className="h-8" aria-label="Edit">
          <SettingsIcon />
        </Button>
      </P.Trigger>
      <E.StyledPopoverContent>
        <E.StyledPopoverArrow />
        <div className="space-y-2 min-w-[200px]">
          <div className="font-bold text-sm pb-1">
            {translate("customLayers.vectorFile")}
          </div>
          <InlineField
            name={translate("name")}
            layout="fixed-label"
            labelSize="md"
          >
            <input
              type="text"
              className={E.inputClass({ _size: "sm" })}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameCommit();
              }}
              autoComplete="off"
            />
          </InlineField>
          {layerConfig.type === "GEOJSON" && (
            <>
              <InlineField
                name={translate("customLayers.color")}
                layout="fixed-label"
                labelSize="md"
              >
                <div className="h-7 border rounded-sm overflow-hidden">
                  <ColorPopover
                    color={layerConfig.color}
                    onChange={(color) =>
                      applyChanges({
                        putLayerConfigs: [
                          { ...layerConfig, color } as ILayerConfig,
                        ],
                      })
                    }
                  />
                </div>
              </InlineField>
              <InlineField
                name={`${translate("customLayers.lineWidth")} (px)`}
                layout="fixed-label"
                labelSize="md"
              >
                <NumericField
                  label={translate("customLayers.lineWidth")}
                  displayValue={String(layerConfig.lineWidth)}
                  positiveOnly={true}
                  isNullable={false}
                  styleOptions={{ padding: "sm" }}
                  onChangeValue={(v) =>
                    applyChanges({
                      putLayerConfigs: [
                        { ...layerConfig, lineWidth: v } as ILayerConfig,
                      ],
                    })
                  }
                />
              </InlineField>
            </>
          )}
          <InlineField
            name={`${translate("customLayers.opacity")} (%)`}
            layout="fixed-label"
            labelSize="md"
          >
            <NumericField
              label={translate("customLayers.opacity")}
              displayValue={String(Math.round(layerConfig.opacity * 100))}
              positiveOnly={true}
              isNullable={false}
              styleOptions={{ padding: "sm" }}
              onChangeValue={(v) =>
                applyChanges({
                  putLayerConfigs: [
                    {
                      ...layerConfig,
                      opacity: clamp(Math.round(v) / 100, 0, 1),
                    } as ILayerConfig,
                  ],
                })
              }
            />
          </InlineField>
          <InlineField
            name={translate("customLayers.labels")}
            layout="fixed-label"
            labelSize="md"
          >
            <Checkbox
              checked={layerConfig.labelVisibility}
              onChange={(e) =>
                applyChanges({
                  putLayerConfigs: [
                    {
                      ...layerConfig,
                      labelVisibility: e.target.checked,
                    } as ILayerConfig,
                  ],
                })
              }
            />
          </InlineField>
        </div>
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <LayerConfigItem typeLabel="Vector file">
      <span className="block select-none truncate flex-auto text-sm">
        {layerConfig.name}
      </span>
      {settingsPopover}
      <VisibilityToggle layerConfig={layerConfig} />
      <Button
        variant="quiet/mode"
        className="h-8 text-red-500"
        aria-label={translate("delete")}
        onClick={handleDelete}
      >
        <DeleteIcon />
      </Button>
    </LayerConfigItem>
  );
};

function SortableLayerConfig({ layerConfig }: { layerConfig: ILayerConfig }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: layerConfig.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex gap-x-2 items-start -ml-1 -mr-1"
      key={layerConfig.id}
    >
      <div
        className="opacity-20 hover:opacity-100 cursor-ns-resize flex items-center h-8"
        {...attributes}
        {...listeners}
      >
        <Draggable />
      </div>
      {layerConfig.type === "MAPBOX" && layerConfig.isBasemap && (
        <BaseMapItem layerConfig={layerConfig} />
      )}
      {layerConfig.type === "MAPBOX" && !layerConfig.isBasemap && (
        <MapboxItem layerConfig={layerConfig} />
      )}
      {layerConfig.type === "XYZ" && <XYZItem layerConfig={layerConfig} />}
      {layerConfig.type === "TILEJSON" && (
        <TileJSONItem layerConfig={layerConfig} />
      )}
      {layerConfig.type === "GEOJSON" && (
        <VectorFileItem layerConfig={layerConfig} />
      )}
    </div>
  );
}

export { FORM_ERROR } from "src/core/components/Form";

function SortableGroup({
  items,
  sensors,
  applyChanges,
  allItems,
}: {
  items: ILayerConfig[];
  sensors: ReturnType<typeof useSensors>;
  applyChanges: ReturnType<typeof useLayerConfigState>["applyChanges"];
  allItems: ILayerConfig[];
}) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id === over?.id) return;

    const oldIndex = allItems.findIndex((item) => item.id === active.id);
    const newIndex = allItems.findIndex((item) => item.id === over?.id);
    const ordered = arrayMove(allItems, oldIndex, newIndex);
    const idx = ordered.findIndex((item) => item.id === active.id);
    const layerConfig = ordered[idx];
    let at = "a0";
    try {
      at = generateKeyBetween(
        ordered[idx - 1]?.at || null,
        ordered[idx + 1]?.at || null,
      );
    } catch (e) {}

    applyChanges({ putLayerConfigs: [{ ...layerConfig, at }] });
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((layerConfig) => (
          <SortableLayerConfig layerConfig={layerConfig} key={layerConfig.id} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

export function LayersEditor() {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  const items = [...layerConfigs.values()];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const gisItems = items.filter((item) => item.type === "GEOJSON");
  const otherItems = items.filter((item) => item.type !== "GEOJSON");

  return (
    <div className="flex flex-col gap-y-1">
      <SortableGroup
        items={otherItems}
        sensors={sensors}
        applyChanges={applyChanges}
        allItems={items}
      />
      <SortableGroup
        items={gisItems}
        sensors={sensors}
        applyChanges={applyChanges}
        allItems={items}
      />
    </div>
  );
}

const LayerTypeButton = ({
  type,
  mode,
  children,
  needsUpgrade,
  onModeChange,
  onUpgrade,
}: {
  type: string;
  mode: Mode;
  children: ReactNode;
  needsUpgrade: boolean;
  onModeChange: (mode: Mode, type: string) => void;
  onUpgrade: () => void;
}) => {
  return (
    <E.Button
      className="flex items-center justify-between "
      onClick={() => {
        if (needsUpgrade) {
          onUpgrade();
        } else {
          onModeChange(mode, type);
        }
      }}
    >
      {children}
      {needsUpgrade && <UpgradeTag />}
      {!needsUpgrade && <ChevronRightIcon />}
    </E.Button>
  );
};

const UpgradeTag = () => {
  const translate = useTranslate();
  return (
    <span className="bg-purple-100 text-purple-500 text-xs px-1 rounded-md">
      {translate("upgrade").toUpperCase()}
    </span>
  );
};
