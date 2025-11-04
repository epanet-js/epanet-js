import type { HandlerContext, DragTarget } from "src/types";
import type { FlatbushLike } from "src/lib/generate-flatbush-instance";
import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
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
  currentZoomAtom,
} from "src/state/jotai";
import { MapEngine } from "./map-engine";
import { EmptyIndex } from "src/lib/generate-flatbush-instance";
import * as CM from "@radix-ui/react-context-menu";
import { env } from "src/lib/env-client";
import { ContextInfo, MapContextMenu } from "src/map/ContextMenu";
import { useModeHandlers } from "./mode-handlers";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map-component-utils";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePersistence } from "src/lib/persistence/context";
import { useAtom, useAtomValue } from "jotai";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useAtomCallback } from "jotai/utils";
import { isDebugAppStateOn, isDebugOn } from "src/infra/debug-mode";
import { useMapStateUpdates } from "./state-updates";
import { clickableLayers } from "./layers/layer";
import { SatelliteToggle } from "./SatelliteToggle";
import { Hints } from "src/components/hints";
import { useAuth } from "src/auth";
import { satelliteLimitedZoom } from "src/commands/toggle-satellite";
import { useTranslate } from "src/hooks/use-translate";
import { MapLoading } from "./map-loader";
import { supportEmail } from "src/global-config";
import { MapHandlers } from "./types";
import { PipeDrawingFloatingPanel } from "src/components/pipe-drawing-floating-panel";
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
  const [currentZoom, setCurrentZoom] = useAtom(currentZoomAtom);

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
  const cursor = useAtomValue(cursorStyleAtom);
  const [initError, setInitError] = useState<boolean>(false);

  // Refs
  const mapRef: React.MutableRefObject<MapEngine | null> =
    useRef<MapEngine>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  const dragTargetRef: React.MutableRefObject<DragTarget | null> =
    useRef<DragTarget>(null);
  const mapHandlers = useRef<MapHandlers>();

  useMapStateUpdates(mapRef.current);

  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current || !mapHandlers) return;

    try {
      mapRef.current = new MapEngine({
        element: mapDivRef.current,
        handlers: mapHandlers as MutableRefObject<MapHandlers>,
      });
      setMap(mapRef.current);
    } catch (error) {
      if (error && (error as Error).message.match(/webgl/i)) {
        setInitError(true);
        return;
      }
      throw error;
    }

    return () => {
      setMap(null);
      if (mapRef.current && "remove" in mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
    };
  }, [mapRef, mapDivRef, setMap]);

  if (isDebugOn) (window as any).mapEngine = mapRef.current;

  const handlerContext: HandlerContext = {
    flatbushInstance,
    setFlatbushInstance,
    mode,
    dragTargetRef,
    hydraulicModel,
    folderMap,
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
      setCurrentZoom(zoom);
    },
  };

  useHotkeys(
    ["esc"],
    () => {
      HANDLERS[mode.mode].exit();
    },
    [HANDLERS, mode],
    "EXIT MODE",
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const handler = HANDLERS[mode.mode];
      if (handler.keydown) {
        handler.keydown(e);
      }
    },
    [HANDLERS, mode],
  );

  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const handler = HANDLERS[mode.mode];
      if (handler.keyup) {
        handler.keyup(e);
      }
    },
    [HANDLERS, mode],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

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
            features: wrappedFeaturesFromMapFeatures(featureUnderMouse, assets),
            position,
            selectedFeatures,
          });
        }
      },
      [mapDivRef],
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
    if (cursor === "grab") return "placemark-cursor-grab";
    if (cursor === "not-allowed") return "placemark-cursor-not-allowed";
    if (cursor === "replace") return "placemark-cursor-replace";
    if (mode.mode !== Mode.NONE) return "placemark-cursor-crosshair";

    if (cursor === "move") return "cursor-move";
    if (cursor === "pointer") return "placemark-cursor-pointer";

    return "placemark-cursor-default";
  }, [cursor, mode]);

  if (initError) return <MapError />;

  return (
    <CM.Root modal={false} onOpenChange={onOpenChange}>
      <CM.Trigger asChild onContextMenu={onContextMenu}>
        <div
          className={clsx("w-full h-full mapboxgl-map", cursorStyle)}
          ref={mapDivRef}
          data-testid="map"
        ></div>
      </CM.Trigger>
      <MapContextMenu contextInfo={contextInfo} />
      <Hints />
      <MapLoading />
      <SatelliteToggle />
      <SatelliteResolutionMessage zoom={currentZoom} />
      <PipeDrawingFloatingPanel />
    </CM.Root>
  );
});

const MapError = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="flex flex-col items-start max-w-screen-sm p-6">
        <h3 className="text-md font-semibold text-gray-700 mb-4">
          {translate("cannotRenderMap")}
        </h3>
        <p className="text-sm mb-2">{translate("cannotRenderMapExplain")}</p>
        <p className="text-sm ">
          {translate("cannotRenderMapAction", supportEmail)}
        </p>
      </div>
    </div>
  );
};

const SatelliteResolutionMessage = ({ zoom }: { zoom: number | undefined }) => {
  const translate = useTranslate();
  const isSatelliteModeOn = useAtomValue(satelliteModeOnAtom);
  const { isSignedIn } = useAuth();

  if (isSatelliteModeOn && !isSignedIn && zoom && zoom > satelliteLimitedZoom) {
    return (
      <div
        className={clsx(
          "absolute mx-auto mb-2 flex items-center justify-center w-full",
          "top-[60px] sm:top-1/2",
        )}
      >
        <div className="bg-gray-800 text-white rounded shadow-md py-1 px-2 m-2">
          {translate("signUpToUnlockResolution")}
        </div>
      </div>
    );
  }

  return null;
};
