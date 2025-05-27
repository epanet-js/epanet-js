import {
  CaretLeftIcon,
  CaretRightIcon,
  DragHandleDots2Icon,
  ExclamationTriangleIcon,
  GearIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import debounce from "lodash/debounce";
import * as T from "@radix-ui/react-tooltip";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { dialogAtom, layerConfigAtom } from "src/state/jotai";
import * as E from "src/components/elements";
import * as P from "@radix-ui/react-popover";
import LAYERS from "src/lib/default_layers";
import { DefaultLayerItem } from "./default_layer_item";
import { newFeatureId } from "src/lib/id";
import { Form, FORM_ERROR } from "src/core/components/Form";
import { LabeledTextField } from "src/core/components/LabeledTextField";
import { TextWell } from "src/components/elements";
import { ILayerConfig, zLayerConfig } from "src/types";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToFirstScrollableAncestor,
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
import { useQuery as reactUseQuery } from "react-query";
import { ReactNode, Suspense, useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { match } from "ts-pattern";
import { getTileJSON, get, getMapboxLayerURL } from "src/lib/utils";
import clamp from "lodash/clamp";
import { useLayerConfigState } from "src/map/layer-config";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { translate } from "src/infra/i18n";
import { isFeatureOn } from "src/infra/feature-flags";
import { limits } from "src/user-plan";
import { useAuth } from "src/auth";
import { zTileJSON } from "src/lib/tile-json";

type Mode =
  | "custom"
  | "basemap"
  | "custom-xyz"
  | "custom-mapbox"
  | "custom-tilejson";

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

/**
 * If there's an existing Mapbox style layer
 * in the stack, replace it and use its `at` value.
 */
export function maybeDeleteOldMapboxLayer(items: ILayerConfig[]): {
  deleteLayerConfigs: ILayerConfig["id"][];
  oldAt: string | undefined;
  oldMapboxLayer: ILayerConfig | undefined;
} {
  let oldAt: string | undefined;
  const oldMapboxLayer = items.find((layer) => layer.type === "MAPBOX");

  const deleteLayerConfigs: string[] = [];

  if (oldMapboxLayer) {
    oldAt = oldMapboxLayer.at;
    deleteLayerConfigs.push(oldMapboxLayer.id);
  }
  return {
    oldAt,
    deleteLayerConfigs,
    oldMapboxLayer,
  };
}

const MapboxStyleSkeleton = z.object({
  version: z.number(),
  name: z.string(),
});

function BackButton({ to }: { to: Mode }) {
  const setMode = useSetAtom(layerModeAtom);
  return (
    <E.Button
      type="button"
      size="xs"
      onClick={() => {
        setMode(to);
      }}
    >
      <CaretLeftIcon />
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
  return (
    <div className="flex justify-between items-center pb-2">
      <div className="font-bold">{children}</div>
      {isEditing ? (
        <P.Close asChild>
          <E.Button type="button" size="xs">
            {translate("cancel")}
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
    if (oldMapboxLayer && !isFeatureOn("FLAG_LABELS")) {
      oldMapboxLayer.isBasemap
        ? toast("Basemap replaced with custom mapbox layer")
        : toast("Mapbox layer replaced");
    }

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
      submitText={isEditing ? translate("updateLayer") : translate("addLayer")}
      fullWidthSubmit
      onSubmit={handleSubmit}
    >
      <LayerFormHeader isEditing={isEditing}>Mapbox</LayerFormHeader>
      <TextWell variant="primary" size="xs">
        {translate("checkMapboxDocs")}{" "}
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
      type: "TILEJSON",
      isBasemap: false,
    } as const);

  return (
    <Form
      schema={zLayerConfig}
      initialValues={initialValues}
      submitText={isEditing ? translate("updateLayer") : translate("addLayer")}
      fullWidthSubmit
      onSubmit={async (values) => {
        try {
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
        {translate("supports")}{" "}
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
      submitText={isEditing ? translate("updateLayer") : translate("addLayer")}
      fullWidthSubmit
      onSubmit={async (values) => {
        userTracking.capture({
          name: "customLayer.added",
          type: "XYZ",
        });
        if (isFeatureOn("FLAG_LABELS")) {
          applyChanges({
            putLayerConfigs: [
              {
                ...values,
                at: layer?.at || getNextAt(items),
                id: values.id || newFeatureId(),
              },
            ],
          });
        } else {
          await toast.promise(
            Promise.resolve(
              applyChanges({
                putLayerConfigs: [
                  {
                    ...values,
                    at: layer?.at || getNextAt(items),
                    id: values.id || newFeatureId(),
                  },
                ],
              }),
            ),
            {
              loading: isEditing
                ? translate("updatingLayer")
                : translate("addingLayer"),
              success: isEditing
                ? translate("layerUpdated")
                : translate("layerAdded"),
              error: "Error",
            },
          );
        }

        setMode("custom");
        if (onDone) {
          onDone();
        }
      }}
    >
      <LayerFormHeader isEditing={isEditing}>XYZ</LayerFormHeader>

      <TextWell variant="primary" size="xs">
        {translate("supports")}{" "}
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
      <TextWell>{translate("xyzURLContain")}</TextWell>
      <label className="flex items-center gap-x-2 text-sm py-2">
        <E.FieldCheckbox name="tms" type="checkbox" /> TMS
      </label>
    </Form>
  );
}

function AddLayer({ onClose }: { onClose: () => void }) {
  const [isOpen, setOpen] = useState<boolean>(false);
  const [mode, setMode] = useAtom(layerModeAtom);
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const { user } = useAuth();

  const canAddCustomLayers = useMemo(() => {
    if (!isFeatureOn("FLAG_UPGRADE")) return true;

    return limits.canAddCustomLayers(user.plan);
  }, [user]);

  const handleUpgrade = () => {
    userTracking.capture({
      name: "upgradeButton.clicked",
      source: "customLayers",
    });
    setOpen(false);
    onClose();
    setDialogState({ type: "upgrade" });
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
          aria-label={translate("addCustom")}
          onClick={() => {
            userTracking.capture({ name: "addCustomLayer.clicked" });
          }}
        >
          <PlusIcon />
          {translate("addCustom")}
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
                    <div className="font-bold">{translate("chooseType")}</div>
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
              .exhaustive()}
          </Suspense>
        </E.StyledPopoverContent>
      </P.Portal>
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
      {Object.entries(LAYERS).map(([id, mapboxLayer]) => (
        <DefaultLayerItem
          key={id}
          mapboxLayer={mapboxLayer}
          onSelect={(layer) => {
            const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
              maybeDeleteOldMapboxLayer(items);
            if (deleteLayerConfigs.length && !isFeatureOn("FLAG_LABELS")) {
              toast("Basemap changed");
            }
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
                },
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
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <div
      role="checkbox"
      title={translate("toggleVisibility")}
      aria-checked={layerConfig.visibility}
      className={"opacity-30 hover:opacity-100 select-none cursor-pointer"}
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
    </div>
  );
};

const LabelsToggle = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <div
      role="checkbox"
      title={translate("toggleLabelsVisibility")}
      aria-checked={layerConfig.labelVisibility}
      className={"opacity-30 hover:opacity-100 select-none cursor-pointer"}
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
    </div>
  );
};

const BaseMapItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
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
          options={Object.entries(LAYERS).map(([, mapboxLayer]) => ({
            value: mapboxLayer.name,
            label: mapboxLayer.name,
          }))}
          selected={layerConfig.name}
          onChange={(name) => {
            const newMapboxLayer = Object.values(LAYERS).find(
              (l) => l.name === name,
            );
            if (!newMapboxLayer) return;

            const { deleteLayerConfigs, oldAt, oldMapboxLayer } =
              maybeDeleteOldMapboxLayer(items);
            if (deleteLayerConfigs.length && !isFeatureOn("FLAG_LABELS")) {
              toast("Basemap changed");
            }
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
        <button
          className={"opacity-30 hover:opacity-100 select-none"}
          title="Edit"
        >
          <GearIcon />
        </button>
      </P.Trigger>
      <E.StyledPopoverContent>
        <E.StyledPopoverArrow />
        <MapboxLayer layer={layerConfig} onDone={() => setEditing(false)} />
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <div className="flex-auto">
      <div className="flex gap-x-2 items-center">
        <span className="block select-none truncate flex-auto text-sm">
          {layerConfig.name}
        </span>
        {editPopover}
        {isRaster && <OpacitySetting layerConfig={layerConfig} />}
        <VisibilityToggle layerConfig={layerConfig} />
        <LabelsToggle layerConfig={layerConfig} />
        <DeleteLayerButton layerConfig={layerConfig} />
      </div>
      <div
        className="opacity-50 font-semibold"
        style={{
          fontSize: 10,
        }}
      >
        MAPBOX
      </div>
    </div>
  );
};

const DeleteLayerButton = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const { applyChanges } = useLayerConfigState();
  const userTracking = useUserTracking();

  return (
    <button
      className={"opacity-30 hover:opacity-100 select-none"}
      onClick={() => {
        userTracking.capture({ name: "layer.removed", type: layerConfig.type });
        applyChanges({
          deleteLayerConfigs: [layerConfig.id],
        });
      }}
    >
      <TrashIcon />
    </button>
  );
};

const XYZItem = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const [isEditing, setEditing] = useState<boolean>(false);

  const editPopover = (
    <P.Root open={isEditing} onOpenChange={(val) => setEditing(val)}>
      <P.Trigger asChild>
        <button
          className={"opacity-30 hover:opacity-100 select-none"}
          title="Edit"
        >
          <GearIcon />
        </button>
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
  const { isError } = reactUseQuery(
    layerConfig.url,
    async () => layerConfig.type === "TILEJSON" && getTileJSON(layerConfig.url),
    { suspense: false, retry: false },
  );

  const editPopover = (
    <P.Root open={isEditing} onOpenChange={(val) => setEditing(val)}>
      <P.Trigger asChild>
        <button
          className={"opacity-30 hover:opacity-100 select-none"}
          title="Edit"
        >
          <GearIcon />
        </button>
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
            <ExclamationTriangleIcon className="text-red-500 dark:text-red-300" />
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
    <div className="flex-auto">
      <div className="flex gap-x-2 items-center">{children}</div>
      <div
        className="opacity-50 font-semibold"
        style={{
          fontSize: 10,
        }}
      >
        {typeLabel}
      </div>
    </div>
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
      className="py-1 group flex gap-x-2 items-start"
      key={layerConfig.id}
    >
      <div
        className="pt-0.5 opacity-20 hover:opacity-100 cursor-ns-resize"
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon />
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
    </div>
  );
}

export { FORM_ERROR } from "src/core/components/Form";

export function LayersPopover({ onClose }: { onClose: () => void }) {
  const layerConfigs = useAtomValue(layerConfigAtom);
  const { applyChanges } = useLayerConfigState();
  const items = [...layerConfigs.values()];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over?.id);
      const ordered = arrayMove(items, oldIndex, newIndex);
      const idx = ordered.findIndex((item) => item.id === active.id);
      const layerConfig = ordered[idx];
      let at = "a0";
      try {
        at = generateKeyBetween(
          ordered[idx - 1]?.at || null,
          ordered[idx + 1]?.at || null,
        );
      } catch (e) {}

      applyChanges({
        putLayerConfigs: [
          {
            ...layerConfig,
            at,
          },
        ],
      });
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between pb-2">
        <div className="font-bold">{translate("layers")}</div>
        <div className="relative">
          <AddLayer onClose={onClose} />
        </div>
      </div>
      <div
        className="placemark-scrollbar overflow-y-auto"
        style={{
          maxHeight: 300,
        }}
      >
        <DndContext
          onDragEnd={handleDragEnd}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[
            restrictToVerticalAxis,
            restrictToFirstScrollableAncestor,
          ]}
        >
          <div
            className="pt-3 border-t
            border-gray-100 dark:border-gray-700 "
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <div className="gap-y-4">
                {items.map((layerConfig) => {
                  return (
                    <SortableLayerConfig
                      layerConfig={layerConfig}
                      key={layerConfig.id}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </div>
        </DndContext>
      </div>
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
      {!needsUpgrade && <CaretRightIcon />}
    </E.Button>
  );
};

const UpgradeTag = () => {
  return (
    <span className="bg-purple-100 text-purple-500 text-xs px-1 rounded-md">
      {translate("upgrade").toUpperCase()}
    </span>
  );
};
