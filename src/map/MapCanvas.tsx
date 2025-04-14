import type { HandlerContext, DragTarget } from "src/types";
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
import {
  ephemeralStateAtom,
  modeAtom,
  Mode,
  dataAtom,
  selectedFeaturesAtom,
  cursorStyleAtom,
  Sel,
  Data,
  EphemeralEditingState,
  satelliteModeOnAtom,
} from "src/state/jotai";
import { MapContext } from "src/map";
import { MapEngine, MapHandlers } from "./map-engine";
import { EmptyIndex } from "src/lib/generate_flatbush_instance";
import * as CM from "@radix-ui/react-context-menu";
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
import { isDebugAppStateOn, isDebugOn } from "src/infra/debug-mode";
import { useMapStateUpdates } from "./state-updates";
import { clickableLayers } from "./layers/layer";
import { searchNearbyRenderedFeatures } from "./search";
import { SatelliteToggle } from "./SatelliteToggle";
import { Hints } from "src/components/Hints";
import { useAuth } from "src/auth";
import { satelliteLimitedZoom } from "src/commands/toggle-satellite";
import { translate } from "src/infra/i18n";
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
        `MODE_HANDLDER@${method} ${JSON.stringify({
          event: e.type,
          mode,
          selection: selection.type,
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
  const [zoom, setZoom] = useState<number>();

  if (isDebugAppStateOn) exposeAppStateInWindow(data, ephemeralState);

  const { folderMap, hydraulicModel } = data;
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
  const map = useContext(MapContext);

  const idMap = rep.idMap;

  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current || !mapHandlers) return;

    mapRef.current = new MapEngine({
      element: mapDivRef.current,
      handlers: mapHandlers as MutableRefObject<MapHandlers>,
    });
    setMap(mapRef.current);

    return () => {
      setMap(null);
      if (mapRef.current && "remove" in mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
  }, [mapRef, mapDivRef, setMap]);

  if (isDebugOn) (window as any).mapEngine = mapRef.current;

  const throttledMovePointer = useMemo(() => {
    function fastMovePointer(point: mapboxgl.Point) {
      if (!map) return;

      const features = searchNearbyRenderedFeatures(map, {
        point,
        distance: 7,
        layers: clickableLayers,
      });

      const visibleFeatures = features.filter((f) => !f.state.hidden);
      setCursor(visibleFeatures.length ? "pointer" : "");
    }
    return fastMovePointer;
  }, [map, setCursor]);

  const handlerContext: HandlerContext = {
    flatbushInstance,
    setFlatbushInstance,
    throttledMovePointer,
    mode,
    dragTargetRef,
    hydraulicModel,
    folderMap,
    idMap,
    selection,
    map: mapRef.current!,
    rep,
  };

  const HANDLERS = useModeHandlers(handlerContext);

  const leftClick = 0;
  const newHandlers: MapHandlers = {
    onClick: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "click");
      HANDLERS[mode.mode].click(e);
    },
    onMapMouseDown: (e: mapboxgl.MapMouseEvent) => {
      debug(e, mode.mode, selection, dragTargetRef, "onMapMouseDown");
      if (e.originalEvent.button === leftClick) HANDLERS[mode.mode].down(e);
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
      if (e.originalEvent.button === leftClick) HANDLERS[mode.mode].up(e);
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
    onZoom: (e: mapboxgl.MapBoxZoomEvent) => {
      const zoom = e.target.getZoom();
      setZoom(zoom);
    },
  };

  useHotkeys(
    isFeatureOn("FLAG_PUMP") ? ["esc"] : ["esc", "enter"],
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
        const {
          hydraulicModel: { assets },
        } = get(dataAtom);
        const mapDivBox = mapDivRef.current?.getBoundingClientRect();
        const map = mapRef.current;
        if (mapDivBox && map) {
          const featureUnderMouse = map.map.queryRenderedFeatures(
            [event.pageX - mapDivBox.left, event.pageY - mapDivBox.top],
            {
              layers: clickableLayers,
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
              assets,
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

    if (mode.mode === Mode.NONE) return "placemark-cursor-default";

    if (
      mode.mode === Mode.DRAW_PIPE ||
      mode.mode === Mode.DRAW_JUNCTION ||
      mode.mode === Mode.DRAW_RESERVOIR ||
      mode.mode === Mode.DRAW_PUMP
    )
      return "placemark-cursor-crosshair";
    return "auto";
  }, [cursor, mode]);

  return (
    <CM.Root modal={false} onOpenChange={onOpenChange}>
      <CM.Trigger asChild onContextMenu={onContextMenu}>
        <div
          className={clsx(
            "top-0 bottom-0 left-0 right-0 mapboxgl-map",
            cursorStyle,
          )}
          ref={mapDivRef}
          data-testid="map"
          style={{
            position: "absolute",
          }}
        ></div>
      </CM.Trigger>
      <MapContextMenu contextInfo={contextInfo} />
      <LastSearchResult />
      <Hints />
      <SatelliteToggle />
      <SatelliteResolutionMessage zoom={zoom} />
    </CM.Root>
  );
});

const SatelliteResolutionMessage = ({ zoom }: { zoom: number | undefined }) => {
  const isSatelliteModeOn = useAtomValue(satelliteModeOnAtom);
  const { isSignedIn } = useAuth();

  if (isSatelliteModeOn && !isSignedIn && zoom && zoom > satelliteLimitedZoom) {
    return (
      <div className="absolute bottom-[48px] mx-auto mb-2 flex items-center justify-center w-full">
        <div className="bg-gray-800 text-white rounded shadow-md py-1 px-2">
          {translate("signUpToUnlockResolution")}
        </div>
      </div>
    );
  }

  return null;
};
