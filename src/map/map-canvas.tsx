import type { HandlerContext, DragTarget } from "src/types";
import type { Sel } from "src/selection/types";
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
import { dataAtom, Data } from "src/state/data";
import { projectSettingsAtom } from "src/state/project-settings";
import { ephemeralStateAtom, EphemeralEditingState } from "src/state/drawing";
import {
  stagingModelDerivedAtom,
  selectedFeaturesDerivedAtom,
} from "src/state/derived-branch-state";
import {
  cursorStyleAtom,
  satelliteModeOnAtom,
  currentZoomAtom,
  mapViewportAtom,
} from "src/state/map";
import { useSetAtom } from "jotai";
import { modeAtom, Mode } from "src/state/mode";
import { MapEngine } from "./map-engine";
import { EmptyIndex } from "src/lib/generate-flatbush-instance";
import * as CM from "@radix-ui/react-context-menu";
import { env } from "src/lib/env-client";
import { ContextInfo, MapContextMenu } from "src/map/ContextMenu";
import { useModeHandlers } from "./mode-handlers";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map-component-utils";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePersistence } from "src/lib/persistence";
import { useAtom, useAtomValue } from "jotai";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useAtomCallback } from "jotai/utils";
import { isDebugAppStateOn, isDebugOn } from "src/infra/debug-mode";
import { useMapStateUpdates } from "./state-updates";
import { clickableLayers } from "./layers/layer";
import { SatelliteToggle } from "./SatelliteToggle";
import { useFitToExtent } from "./use-fit-to-extent";
import {
  CustomMapControlClick,
  FIT_TO_EXTENT_CONTROL,
} from "./custom-map-control";
import { Hints } from "src/components/hints";
import { useAuth } from "src/hooks/use-auth";
import { satelliteLimitedZoom } from "src/commands/toggle-satellite";
import { useTranslate } from "src/hooks/use-translate";
import { supportEmail } from "src/global-config";
import { MapHandlers } from "./types";
import { PipeDrawingFloatingPanel } from "src/components/pipe-drawing-floating-panel";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import {
  profileViewAtom,
  profileHoverAtom,
  profileModifierAtom,
} from "src/state/profile-view";
import { findPaths } from "src/hydraulic-model/path-finding";
import { subtractFromPath } from "src/map/mode-handlers/profile-view";
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
  const setMapViewport = useSetAtom(mapViewportAtom);
  const readViewport = useAtomCallback(
    useCallback((get) => get(mapViewportAtom), []),
  );

  const data = useAtomValue(dataAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const [currentZoom, setCurrentZoom] = useAtom(currentZoomAtom);

  if (isDebugAppStateOn) exposeAppStateInWindow(data, ephemeralState);

  const { folderMap } = data;
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const profileView = useAtomValue(profileViewAtom);
  const profileHoverId = useAtomValue(profileHoverAtom);
  const profileModifier = useAtomValue(profileModifierAtom);

  useEffect(() => {
    const map = mapRef.current?.map;
    if (!map) return;
    const pathSource = map.getSource("profile-path") as
      | mapboxgl.GeoJSONSource
      | undefined;
    const addSource = map.getSource("profile-hover") as
      | mapboxgl.GeoJSONSource
      | undefined;
    const removeSource = map.getSource("profile-hover-remove") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!pathSource || !addSource || !removeSource) return;

    const empty: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };

    const buildLinkFeatures = (linkIds: number[]): GeoJSON.Feature[] =>
      linkIds.flatMap((linkId) => {
        const link = hydraulicModel.assets.get(linkId);
        if (!link || !link.isLink) return [];
        return [
          {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: (link as any).coordinates,
            },
          },
        ];
      });

    const buildNodeFeatures = (nodeIds: number[]): GeoJSON.Feature[] =>
      nodeIds.flatMap((nodeId) => {
        const node = hydraulicModel.assets.get(nodeId);
        if (!node || node.isLink) return [];
        return [
          {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "Point" as const,
              coordinates: (node as any).coordinates,
            },
          },
        ];
      });

    // showingProfile phase: persist current path in dedicated source
    if (profileView.phase === "showingProfile") {
      pathSource.setData({
        type: "FeatureCollection",
        features: buildLinkFeatures(profileView.path.linkIds),
      });

      if (profileHoverId !== null && profileModifier !== "none") {
        if (profileModifier === "extend" && !profileHoverId.isLink) {
          const hoveredNodeId = profileHoverId.id;
          if (
            hoveredNodeId === profileView.startNodeId ||
            hoveredNodeId === profileView.endNodeId
          ) {
            addSource.setData(empty);
            removeSource.setData(empty);
            return;
          }

          const pathsToStart = findPaths(
            hydraulicModel.topology,
            hydraulicModel.assets,
            hoveredNodeId,
            profileView.startNodeId,
          );
          const pathsToEnd = findPaths(
            hydraulicModel.topology,
            hydraulicModel.assets,
            profileView.endNodeId,
            hoveredNodeId,
          );
          const bestToStart = pathsToStart[0];
          const bestToEnd = pathsToEnd[0];

          const previewPath =
            !bestToStart && bestToEnd
              ? bestToEnd
              : bestToStart && !bestToEnd
                ? bestToStart
                : bestToStart && bestToEnd
                  ? bestToStart.totalLength <= bestToEnd.totalLength
                    ? bestToStart
                    : bestToEnd
                  : null;

          addSource.setData(
            previewPath
              ? {
                  type: "FeatureCollection",
                  features: buildLinkFeatures(previewPath.linkIds),
                }
              : empty,
          );
          removeSource.setData(empty);
          return;
        }

        if (profileModifier === "subtract") {
          const result = subtractFromPath(
            profileView.path,
            profileHoverId.id,
            profileHoverId.isLink,
            hydraulicModel.assets,
          );

          if (result !== null) {
            const resultLinkSet = new Set(result.linkIds);
            const resultNodeSet = new Set(result.nodeIds);
            const removedLinkIds = profileView.path.linkIds.filter(
              (id) => !resultLinkSet.has(id),
            );
            const removedNodeIds = profileView.path.nodeIds.filter(
              (id) => !resultNodeSet.has(id),
            );

            addSource.setData(empty);
            removeSource.setData({
              type: "FeatureCollection",
              features: [
                ...buildLinkFeatures(removedLinkIds),
                ...buildNodeFeatures(removedNodeIds),
              ],
            });
            return;
          }
        }
      }

      addSource.setData(empty);
      removeSource.setData(empty);
      return;
    }

    // selectingEnd phase: preview path from start to hovered node
    pathSource.setData(empty);
    if (
      profileView.phase === "selectingEnd" &&
      profileHoverId !== null &&
      !profileHoverId.isLink &&
      profileHoverId.id !== profileView.startNodeId
    ) {
      const paths = findPaths(
        hydraulicModel.topology,
        hydraulicModel.assets,
        profileView.startNodeId,
        profileHoverId.id,
      );
      const path = paths[0];
      addSource.setData(
        path
          ? {
              type: "FeatureCollection",
              features: buildLinkFeatures(path.linkIds),
            }
          : empty,
      );
      removeSource.setData(empty);
      return;
    }

    addSource.setData(empty);
    removeSource.setData(empty);
  }, [profileView, profileHoverId, profileModifier, hydraulicModel]);

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
  const isEditionBlocked = useIsEditionBlocked();
  const [initError, setInitError] = useState<boolean>(false);

  // Refs
  const mapRef: React.MutableRefObject<MapEngine | null> =
    useRef<MapEngine>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  const dragTargetRef: React.MutableRefObject<DragTarget | null> =
    useRef<DragTarget>(null);
  const mapHandlers = useRef<MapHandlers>();

  const fitToExtent = useFitToExtent();

  const onControlClick = useCallback(
    (event: CustomMapControlClick) => {
      switch (event.name) {
        case FIT_TO_EXTENT_CONTROL:
          fitToExtent(event.map);
          break;
      }
    },
    [fitToExtent],
  );

  useMapStateUpdates(mapRef.current);

  useEffect(() => {
    if (mapRef.current) return;
    if (!mapDivRef.current || !mapHandlers) return;

    try {
      mapRef.current = new MapEngine({
        element: mapDivRef.current,
        handlers: mapHandlers as MutableRefObject<MapHandlers>,
        onControlClick,
        initialViewport: readViewport(),
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
  }, [mapRef, mapDivRef, setMap, onControlClick, readViewport]);

  if (isDebugOn) (window as any).mapEngine = mapRef.current;

  const handlerContext: HandlerContext = {
    flatbushInstance,
    setFlatbushInstance,
    mode,
    dragTargetRef,
    hydraulicModel,
    units,
    folderMap,
    selection,
    map: mapRef.current!,
    rep,
    readonly: isEditionBlocked,
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
      const center = e.target.getCenter();
      setMapViewport({
        center: [center.lng, center.lat],
        zoom: e.target.getZoom(),
      });
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
        const { assets } = get(stagingModelDerivedAtom);
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

          const selectedFeatures = get(selectedFeaturesDerivedAtom);

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

    if (cursor === "crosshair") return "cursor-crosshair";
    if (cursor === "crosshair-add") return "cursor-crosshair-add";
    if (cursor === "crosshair-subtract") return "cursor-crosshair-subtract";

    if (cursor === "pointer-add") return "cursor-pointer-add";
    if (cursor === "pointer-subtract") return "cursor-pointer-subtract";

    if (cursor === "move") return "cursor-move";

    if (
      mode.mode !== Mode.NONE &&
      mode.mode !== Mode.BOUNDARY_TRACE_SELECT &&
      mode.mode !== Mode.UPSTREAM_TRACE_SELECT &&
      mode.mode !== Mode.DOWNSTREAM_TRACE_SELECT
    )
      return "cursor-crosshair";

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
