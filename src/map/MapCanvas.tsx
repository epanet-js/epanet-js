import type { HandlerContext, DragTarget } from "src/types";
import { SYMBOLIZATION_NONE } from "src/types";
import type { FlatbushLike } from "src/lib/generate_flatbush_instance";
import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
  MutableRefObject,
  memo,
} from "react";
import clsx from "clsx";
import throttle from "lodash/throttle";
import mapboxgl /*, { LngLatBoundsLike } */ from "mapbox-gl";
import { captureError } from "src/infra/error-tracking";
import {
  ephemeralStateAtom,
  modeAtom,
  Mode,
  dataAtom,
  selectedFeaturesAtom,
  cursorStyleAtom,
  layerConfigAtom,
  Sel,
  Data,
  EphemeralEditingState,
} from "src/state/jotai";
import { MapContext } from "src/context/map_context";
import { MapEngine, MapHandlers } from "./map-engine";
import { EmptyIndex } from "src/lib/generate_flatbush_instance";
import * as CM from "@radix-ui/react-context-menu";
import { CLICKABLE_LAYERS } from "src/lib/load_and_augment_style";
import { env } from "src/lib/env_client";
import { ContextInfo, MapContextMenu } from "src/map/ContextMenu";
import { useModeHandlers } from "./mode-handlers";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map_component_utils";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePersistence } from "src/lib/persistence/context";
import { useAtom, useAtomValue } from "jotai";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useAtomCallback } from "jotai/utils";
import { LastSearchResult } from "src/components/last_search_result";
import { ModeHints } from "src/components/mode_hints";
import { fMoment } from "src/lib/persistence/moment";
import { captureException } from "@sentry/nextjs";
import { newFeatureId } from "src/lib/id";
import toast from "react-hot-toast";
import { isDebugAppStateOn, isDebugOn } from "src/infra/debug-mode";
import { monitorFrequency } from "src/infra/monitor-frequency";
import { useMapStateUpdates } from "./state-updates";
import { isFeatureOn } from "src/infra/feature-flags";
mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;

mapboxgl.setRTLTextPlugin(
  "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
  (_err) => {
    // console.error(err);
  },
  true, // Lazy load the plugin
);

const exposeAppStateInWindow = (
  data: Data,
  ephemeralState: EphemeralEditingState,
) => {
  if (typeof window === "undefined") return;

  (window as any).appData = data;
  (window as any).appEphemeralState = ephemeralState;
};

const noop = () => null;
const debug = isDebugOn
  ? (
      e: mapboxgl.MapboxEvent<any>,
      mode: Mode,
      selection: Sel,
      dragTargetRef: MutableRefObject<DragTarget | null>,
      method: string,
    ) => {
      // eslint-disable-next-line no-console
      console.log(
        `MODE_HANLDER@${method} ${JSON.stringify({
          event: e.type,
          mode,
          selection,
          dragTargetRef,
          method,
        })}`,
      );
    }
  : noop;

export const MapCanvas = memo(function MapCanvas({
  setMap,
}: {
  setMap: (arg0: MapEngine | null) => void;
}) {
  const rep = usePersistence();

  const data = useAtomValue(dataAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);

  if (isDebugAppStateOn) exposeAppStateInWindow(data, ephemeralState);

  const layerConfigs = useAtomValue(layerConfigAtom);
  const { featureMapDeprecated, folderMap, hydraulicModel } = data;
  // State
  const [flatbushInstance, setFlatbushInstance] =
    useState<FlatbushLike>(EmptyIndex);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  const lastCursor = useRef<{
    cursorLatitude: number;
    cursorLongitude: number;
  }>({
    cursorLatitude: 0,
    cursorLongitude: 0,
  });

  // Atom state
  const selection = data.selection;
  const mode = useAtomValue(modeAtom);
  const [cursor, setCursor] = useAtom(cursorStyleAtom);

  // Refs
  const mapRef: React.MutableRefObject<MapEngine | null> =
    useRef<MapEngine>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  const dragTargetRef: React.MutableRefObject<DragTarget | null> =
    useRef<DragTarget>(null);
  const mapHandlers = useRef<MapHandlers>();

  useMapStateUpdates(mapRef.current);
  // Context
  const map = useContext(MapContext);

  const transact = rep.useTransactDeprecated();

  // Queries
  const [meta, updateMeta] = rep.useMetadata();
  const { label, symbolization } = meta;

  const currentLayer = meta.layer;

  // Only run this effect once.
  const migrated = useRef<boolean>(false);
  useEffect(() => {
    if (currentLayer && !migrated.current) {
      migrated.current = true;
      toast
        .promise(
          Promise.resolve(
            updateMeta({
              layerId: null,
              defaultLayer: null,
            }),
          ).then(() => {
            return transact({
              ...fMoment("Upgrade layers"),
              putLayerConfigs: [
                {
                  ...currentLayer,
                  at: "a0",
                  visibility: true,
                  opacity: 1,
                  tms: false,
                  id: newFeatureId(),
                },
              ],
            });
          }),
          {
            loading: "Upgrading layers",
            success: "Upgraded layers",
            error: "Error migrating layers",
          },
        )
        .catch((e) => {
          captureException(e);
        });
    }
  }, [currentLayer, transact, updateMeta, layerConfigs]);

  // useMap
  //
  // Receives
  // - map & map div refs
  //
  // Emits
  // - map state
  useEffect(() => {
    // Map has already been initialized
    if (mapRef.current) return;
    if (!mapDivRef.current || !mapHandlers) return;

    // This part is not time-sensitive.
    mapRef.current = new MapEngine({
      element: mapDivRef.current,
      layerConfigs,
      handlers: mapHandlers as MutableRefObject<MapHandlers>,
      symbolization: symbolization || SYMBOLIZATION_NONE,
      previewProperty: label,
      idMap: idMap,
    });

    setMap(mapRef.current);

    return () => {
      setMap(null);
      if (mapRef.current && "remove" in mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, [mapRef, mapDivRef, setMap]);

  if (isDebugOn) (window as any).mapEngine = mapRef.current;

  const dataUpdateInProgress = useRef(false);

  const updateEphemeralStateInMap = useAtomCallback(
    useCallback(
      (get) => {
        if (!map?.map || isFeatureOn("FLAG_SPLIT_SOURCES")) return;
        const ephemeralState = get(ephemeralStateAtom);

        map.setEphemeralState(ephemeralState);
      },
      [map],
    ),
  );

  const updateSelectionInMap = useAtomCallback(
    useCallback(
      (get) => {
        if (!map?.map || isFeatureOn("FLAG_SPLIT_SOURCES")) return;
        const { selection } = get(dataAtom);

        map.setOnlySelection(selection);
      },
      [map],
    ),
  );
  useEffect(
    function expensiveDataUpdate() {
      if (!map?.map) return;
      if (isFeatureOn("FLAG_SPLIT_SOURCES")) return;

      dataUpdateInProgress.current = true;

      monitorFrequency("SET_MAP_DATA", { limit: 4, intervalMs: 1000 });
      //eslint-disable-next-line @typescript-eslint/no-floating-promises
      (async () => {
        try {
          await map.setOnlyStyle({
            layerConfigs,
            symbolization: symbolization || SYMBOLIZATION_NONE,
            previewProperty: label,
          });
          await map.setOnlyData(data.hydraulicModel.assets);
        } catch (error) {
          captureError(error as Error);
        } finally {
          updateSelectionInMap();
          updateEphemeralStateInMap();
          dataUpdateInProgress.current = false;
        }
      })();
    },
    [
      map,
      data.hydraulicModel.assets,
      updateSelectionInMap,
      updateEphemeralStateInMap,
      layerConfigs,
      symbolization,
      label,
    ],
  );

  useEffect(
    function onEphemeralStateChange() {
      if (!isFeatureOn("FLAG_SPLIT_SOURCES") || dataUpdateInProgress.current)
        return;

      updateEphemeralStateInMap();
    },
    [ephemeralState, updateEphemeralStateInMap],
  );

  useEffect(
    function onSelectionChange() {
      if (!isFeatureOn("FLAG_SPLIT_SOURCES") || dataUpdateInProgress.current)
        return;

      updateSelectionInMap();
    },
    [data.selection, updateSelectionInMap],
  );

  const throttledMovePointer = useMemo(() => {
    function fastMovePointer(point: mapboxgl.Point) {
      if (!map) return;

      const radius = 7;
      const searchBox = [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ] as unknown as [mapboxgl.Point, mapboxgl.Point];
      const features = map.map.queryRenderedFeatures(searchBox, {
        layers: CLICKABLE_LAYERS,
      });
      setCursor(features.length ? "pointer" : "");
    }
    return fastMovePointer;
  }, [map, setCursor]);

  const idMap = rep.idMap;

  const handlerContext: HandlerContext = {
    flatbushInstance,
    setFlatbushInstance,
    throttledMovePointer,
    mode,
    dragTargetRef,
    featureMapDeprecated,
    hydraulicModel,
    folderMap,
    idMap,
    selection,
    pmap: mapRef.current!,
    rep,
  };

  const HANDLERS = useModeHandlers(handlerContext);

  // const log = false;

  const newHandlers: MapHandlers = {
    onClick: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "click");
      HANDLERS[mode.mode].click(e);
    },
    onMapMouseDown: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapMouseDown");
      HANDLERS[mode.mode].down(e);
    },
    onMapTouchStart: (e: mapboxgl.MapTouchEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapTouchStart");
      const handler = HANDLERS[mode.mode];
      if (handler.touchstart) {
        handler.touchstart(e);
      } else {
        handler.down(e);
      }
    },
    onMapMouseUp: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapMouseUp");
      HANDLERS[mode.mode].up(e);
    },
    onMapTouchEnd: (e: mapboxgl.MapTouchEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapTouchEnd");

      const handler = HANDLERS[mode.mode];
      if (handler.touchend) {
        handler.touchend(e);
      } else {
        handler.up(e);
      }
    },
    onMapTouchMove: (e: mapboxgl.MapTouchEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapTouchMove");

      const handler = HANDLERS[mode.mode];
      if (handler.touchmove) {
        handler.touchmove(e);
      } else {
        handler.move(e);
      }
    },
    onMapMouseMove: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapMouseMove");

      HANDLERS[mode.mode].move(e);
      const map = mapRef.current?.map;
      if (!map) return;
      lastCursor.current = {
        cursorLongitude: e.lngLat.lng,
        cursorLatitude: e.lngLat.lat,
      };
    },
    onDoubleClick: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "doubleClick");

      HANDLERS[mode.mode].double(e);
    },
    onMoveEnd(e: mapboxgl.MapboxEvent & mapboxgl.EventData) {
      debug(e, mode.mode, selection, dragTargetRef, "onMouseMoveEnd");
    },
    onMove: throttle((e: mapboxgl.MapboxEvent & mapboxgl.EventData) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMove");
      const center = e.target.getCenter().toArray();
      const bounds = e.target.getBounds().toArray();
      return {
        center,
        bounds,
      };
    }, 300),
  };

  useHotkeys(
    ["esc", "enter"],
    () => {
      HANDLERS[mode.mode].exit();
    },
    [HANDLERS, mode],
    "EXIT MODE",
  );

  mapHandlers.current = newHandlers;

  const onContextMenu = useAtomCallback(
    useCallback(
      (get, _set, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        const { featureMapDeprecated } = get(dataAtom);
        const mapDivBox = mapDivRef.current?.getBoundingClientRect();
        const map = mapRef.current;
        if (mapDivBox && map) {
          const featureUnderMouse = map.map.queryRenderedFeatures(
            [event.pageX - mapDivBox.left, event.pageY - mapDivBox.top],
            {
              layers: CLICKABLE_LAYERS,
            },
          );

          const position = map.map
            .unproject([
              event.pageX - mapDivBox.left,
              event.pageY - mapDivBox.top,
            ])
            .toArray() as Pos2;

          const selectedFeatures = get(selectedFeaturesAtom);

          setContextInfo({
            features: wrappedFeaturesFromMapFeatures(
              featureUnderMouse,
              featureMapDeprecated,
              rep.idMap,
            ),
            position,
            selectedFeatures,
          });
        }
      },
      [mapDivRef, rep],
    ),
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      setContextInfo((contextInfo) => {
        if (!open && contextInfo) {
          return null;
        }
        return contextInfo;
      });
    },
    [setContextInfo],
  );

  const cursorStyle = useMemo(() => {
    if (cursor === "move") return "cursor-move";
    if (cursor === "pointer") return "placemark-cursor-pointer";

    if (
      mode.mode === Mode.NONE ||
      mode.mode === Mode.DRAW_POLYGON ||
      mode.mode === Mode.DRAW_LINE
    )
      return "placemark-cursor-default";

    if (
      mode.mode === Mode.DRAW_PIPE ||
      mode.mode === Mode.DRAW_RECTANGLE ||
      mode.mode === Mode.DRAW_JUNCTION ||
      mode.mode === Mode.LASSO
    )
      return "placemark-cursor-crosshair";
    return "auto";
  }, [cursor, mode]);

  return (
    <CM.Root modal={false} onOpenChange={onOpenChange}>
      <CM.Trigger asChild onContextMenu={onContextMenu}>
        <div
          className={clsx("top-0 bottom-0 left-0 right-0", cursorStyle)}
          ref={mapDivRef}
          data-testid="map"
          style={{
            position: "absolute",
          }}
        ></div>
      </CM.Trigger>
      <MapContextMenu contextInfo={contextInfo} />
      <LastSearchResult />
      <ModeHints />
    </CM.Root>
  );
});
