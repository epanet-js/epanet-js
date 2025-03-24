import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DragHandleDots2Icon,
  ExclamationTriangleIcon,
  GearIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import * as T from "@radix-ui/react-tooltip";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { layerConfigAtom } from "src/state/jotai";
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
import { Suspense, useState } from "react";
import toast from "react-hot-toast";
import { match } from "ts-pattern";
import { zTileJSON } from "src/mapbox-layers/validations";
import { getTileJSON, get, getMapboxLayerURL } from "src/lib/utils";
import clamp from "lodash/clamp";
import { useLayerConfigState } from "src/map/layer-config";

type Mode =
  | "initial"
  | "custom"
  | "custom-xyz"
  | "custom-mapbox"
  | "custom-tilejson";

const layerModeAtom = atom<Mode>("initial");

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
function maybeDeleteOldMapboxLayer(items: ILayerConfig[]): {
  deleteLayerConfigs: ILayerConfig["id"][];
  oldAt: string | undefined;
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
      Back
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
            Cancel
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
    const { deleteLayerConfigs, oldAt } = maybeDeleteOldMapboxLayer(items);
    if (deleteLayerConfigs.length) {
      toast("Mapbox layer replaced");
    }
    applyChanges({
      deleteLayerConfigs,
      putLayerConfigs: [
        {
          ...values,
          name,
          visibility: true,
          labelVisibility: true,
          tms: false,
          opacity: 1,
          at: oldAt || getNextAt(items),
          id: newFeatureId(),
        },
      ],
    });

    setMode("initial");
    if (onDone) {
      onDone();
    }
  };

  return (
    <Form
      schema={zLayerConfig}
      initialValues={initialValues}
      submitText={isEditing ? "Update layer" : "Add layer"}
      fullWidthSubmit
      onSubmit={handleSubmit}
    >
      <LayerFormHeader isEditing={isEditing}>Mapbox</LayerFormHeader>
      <TextWell variant="primary" size="xs">
        See Mapbox documentation on{" "}
        <a
          target="_blank"
          rel="noreferrer"
          className={E.styledInlineA}
          href="https://docs.mapbox.com/help/glossary/style-url/"
        >
          style URLs
        </a>{" "}
        if you're not sure what to input here.
      </TextWell>
      <LabeledTextField
        name="url"
        label="Style URL"
        required
        autoComplete="off"
        placeholder="mapbox://"
      />
      <LabeledTextField
        name="token"
        required
        label="Access token"
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
      submitText={isEditing ? "Update layer" : "Add layer"}
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
        applyChanges({
          putLayerConfigs: [
            {
              ...values,
              at: layer?.at || getNextAt(items),
              id: values.id || newFeatureId(),
            },
          ],
        });
        setMode("initial");
        if (onDone) {
          onDone();
        }
      }}
    >
      <LayerFormHeader isEditing={isEditing}>TileJSON</LayerFormHeader>
      <TextWell variant="primary" size="xs">
        Raster tiles are supported with{" "}
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
        label="Name"
        required
        autoComplete="off"
        placeholder=""
      />
      <LabeledTextField
        name="url"
        required
        label="TileJSON URL"
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
      submitText={isEditing ? "Update layer" : "Add layer"}
      fullWidthSubmit
      onSubmit={async (values) => {
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
            loading: isEditing ? "Updating layer" : "Adding layer",
            success: isEditing ? "Updated layer" : "Added layer",
            error: "Error",
          },
        );
        setMode("initial");
        if (onDone) {
          onDone();
        }
      }}
    >
      <LayerFormHeader isEditing={isEditing}>XYZ</LayerFormHeader>

      <TextWell variant="primary" size="xs">
        Supports image{" "}
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
        label="Name"
        autoComplete="off"
        required
        placeholder=""
      />
      <LabeledTextField
        name="url"
        label="Template URL"
        autoComplete="off"
        required
        type="url"
        placeholder="https://…"
      />
      <TextWell>
        Template URLs should contain {"{z}"}, {"{x}"}, and {"{y}"}.
      </TextWell>
      <label className="flex items-center gap-x-2 text-sm py-2">
        <E.FieldCheckbox name="tms" type="checkbox" /> TMS
      </label>
    </Form>
  );
}

function AddLayer() {
  const { applyChanges } = useLayerConfigState();
  const [isOpen, setOpen] = useState<boolean>(false);
  const [mode, setMode] = useAtom(layerModeAtom);
  const layerConfigs = useAtomValue(layerConfigAtom);
  const items = [...layerConfigs.values()];
  const nextAt = getNextAt(items);

  const defaultLayerList = (
    <div className="py-2">
      <E.DivLabel>Default layers</E.DivLabel>
      {Object.entries(LAYERS).map(([id, mapboxLayer]) => (
        <DefaultLayerItem
          key={id}
          mapboxLayer={mapboxLayer}
          onSelect={(layer) => {
            const { deleteLayerConfigs, oldAt } =
              maybeDeleteOldMapboxLayer(items);
            if (deleteLayerConfigs.length) {
              toast("Mapbox layer replaced");
            }
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
                  labelVisibility: true,
                },
              ],
            });
          }}
        />
      ))}
      <E.DivSeparator />
      <button
        className={"w-full block " + E.menuItemLike({ variant: "default" })}
        onClick={() => {
          setMode("custom");
        }}
        value="manage"
      >
        <PlusIcon /> Custom
      </button>
    </div>
  );

  return (
    <P.Root
      open={isOpen}
      onOpenChange={(val) => {
        setOpen(val);
        setMode("initial");
      }}
    >
      <P.Trigger asChild>
        <E.Button aria-label="Add layer">
          <PlusIcon />
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
              .with("initial", () => defaultLayerList)
              .with("custom", () => (
                <div className="p-3">
                  <div className="flex justify-between items-center pb-3">
                    <div className="font-bold">Choose type</div>
                    <BackButton to="initial" />
                  </div>
                  <div className="space-y-2 grid grid-cols-1">
                    <E.Button onClick={() => setMode("custom-xyz")}>
                      XYZ
                      <CaretRightIcon />
                    </E.Button>
                    <E.Button onClick={() => setMode("custom-mapbox")}>
                      Mapbox
                      <CaretRightIcon />
                    </E.Button>
                    <E.Button onClick={() => setMode("custom-tilejson")}>
                      TileJSON
                      <CaretRightIcon />
                    </E.Button>
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

const BaseMapOptions = () => {
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
            const { deleteLayerConfigs, oldAt } =
              maybeDeleteOldMapboxLayer(items);
            if (deleteLayerConfigs.length) {
              toast("Mapbox layer replaced");
            }
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
                  labelVisibility: true,
                },
              ],
            });
          }}
        />
      ))}
    </>
  );
};

const OpacitySetting = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const { applyChanges } = useLayerConfigState();

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
        value={Math.round(layerConfig.opacity * 100)}
        onChange={(e) => {
          const opacity = clamp(e.target.valueAsNumber / 100, 0, 1);
          if (isNaN(opacity)) return;
          applyChanges({
            putLayerConfigs: [
              {
                ...layerConfig,
                opacity,
              },
            ],
          });
        }}
      />
      <div className="text-gray-500 text-xs">%</div>
    </div>
  );
};

const VisibilityToggle = ({ layerConfig }: { layerConfig: ILayerConfig }) => {
  const { applyChanges } = useLayerConfigState();

  return (
    <div
      role="checkbox"
      title="Toggle visibility"
      aria-checked={layerConfig.visibility}
      className={"opacity-30 hover:opacity-100 select-none cursor-pointer"}
      onClick={() => {
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

  return (
    <div
      role="checkbox"
      title="Toggle label visibility"
      aria-checked={layerConfig.labelVisibility}
      className={"opacity-30 hover:opacity-100 select-none cursor-pointer"}
      onClick={() => {
        applyChanges({
          putLayerConfigs: [
            {
              ...layerConfig,
              labelVisibility: !layerConfig.labelVisibility,
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
  const [isChanging, setChanging] = useState<boolean>(false);

  const isRaster = layerConfig.name.includes("Satellite");

  const namePopover = (
    <P.Root open={isChanging} onOpenChange={(value) => setChanging(value)}>
      <P.Trigger asChild>
        <div className="flex items-center justify-start  gap-x-2 cursor-pointer">
          <span className="select-none truncate text-sm">
            {layerConfig.name}
          </span>
          <CaretDownIcon />
        </div>
      </P.Trigger>
      <E.StyledPopoverContent>
        <BaseMapOptions />
      </E.StyledPopoverContent>
    </P.Root>
  );

  return (
    <div className="flex-auto">
      <div className="flex gap-x-2 items-center">
        <div className="block flex-auto">
          <div className="w-auto max-w-fit">{namePopover}</div>
        </div>
        {isRaster && <OpacitySetting layerConfig={layerConfig} />}
        <VisibilityToggle layerConfig={layerConfig} />
        <LabelsToggle layerConfig={layerConfig} />
      </div>
      <div
        className="opacity-50 font-semibold"
        style={{
          fontSize: 10,
        }}
      >
        BASEMAP
      </div>
    </div>
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

  return (
    <button
      className={"opacity-30 hover:opacity-100 select-none"}
      onClick={() => {
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
    <LayerConfigItem typeLabel="XYX">
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
    <LayerConfigItem typeLabel="TileJSON">
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

export function LayersPopover() {
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
      <div className="flex justify-between pb-2">
        <div className="font-bold">Layers</div>
        <div className="relative">
          <AddLayer />
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
            border-gray-100 dark:border-gray-700"
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              {items.map((layerConfig) => {
                return (
                  <SortableLayerConfig
                    layerConfig={layerConfig}
                    key={layerConfig.id}
                  />
                );
              })}
            </SortableContext>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
