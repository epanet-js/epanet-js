import type {
  Feature,
  HandlerContext,
  IFeature,
  IWrappedFeature,
  LineString,
  Position,
} from "src/types";
import {
  modeAtom,
  Mode,
  cursorStyleAtom,
  ephemeralStateAtom,
} from "src/state/jotai";
import replaceCoordinates from "src/lib/replace_coordinates";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { useRef } from "react";
import { captureError } from "src/infra/error-tracking";
import { decodeId, newFeatureId } from "../id";
import { isSamePosition } from "../geometry";
import { useKeyboardState } from "src/keyboard";
import { CLICKABLE_LAYERS } from "../load_and_augment_style";
import { MapMouseEvent, MapTouchEvent, PointLike } from "mapbox-gl";
import { UIDMap } from "../id_mapper";
import { useSelection } from "src/selection";

export function usePipeHandlers({
  rep,
  featureMap,
  selection,
  pmap,
  idMap,
  mode,
  dragTargetRef,
}: HandlerContext): Handlers {
  const multi = mode.modeOptions?.multi;
  const { selectFeature } = useSelection(selection);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const usingTouchEvents = useRef<boolean>(false);
  const drawingStart = useRef<Pos2 | null>(null);

  const { isShiftHeld } = useKeyboardState();

  const setDrawingState = (features: IWrappedFeature[]) => {
    setEphemeralState({
      type: "drawLine",
      features,
    });
  };

  const resetDrawingState = () => {
    setEphemeralState({ type: "none" });
  };

  const createExtensionFeature = (start: Position, end: Position) => {
    return {
      id: newFeatureId(),
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [start, end],
        },
      } as Feature,
      folderId: null,
      at: "any",
    };
  };

  const extendLineString = (
    wrappedFeature: IWrappedFeature,
    position: Position,
  ) => {
    const feature = wrappedFeature.feature as IFeature<LineString>;
    const coordinates = feature.geometry.coordinates;

    return {
      ...wrappedFeature,
      feature: replaceCoordinates(
        feature,
        mode.modeOptions?.reverse
          ? [position].concat(coordinates)
          : coordinates.concat([position]),
      ),
    };
  };

  const isAlreadyLastVertex = (
    wrappedFeature: IWrappedFeature,
    position: Position,
  ) => {
    const feature = wrappedFeature.feature as IFeature<LineString>;
    const coordinates = feature.geometry.coordinates;
    const lastPosition = mode.modeOptions?.reverse
      ? coordinates[0]
      : coordinates[coordinates.length - 1];

    return isSamePosition(lastPosition, position);
  };

  const getNeighborCandidate = (point: mapboxgl.Point): string | null => {
    const { x, y } = point;
    const distance = 12;

    const searchBox = [
      [x - distance, y - distance] as PointLike,
      [x + distance, y + distance] as PointLike,
    ] as [PointLike, PointLike];

    const pointFeatures = pmap.map.queryRenderedFeatures(searchBox, {
      layers: CLICKABLE_LAYERS,
    });
    if (!pointFeatures.length) return null;

    const id = pointFeatures[0].id;
    const decodedId = decodeId(id as RawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    return uuid;
  };

  const getSnappingCoordinates = (
    e: MapMouseEvent | MapTouchEvent,
  ): Position => {
    const cursorCoordinates = getMapCoord(e);

    const featureId = getNeighborCandidate(e.point);
    if (!featureId) return cursorCoordinates;

    const wrappedFeature = featureMap.get(featureId);
    if (!wrappedFeature) return cursorCoordinates;

    const { feature } = wrappedFeature;
    if (!feature.geometry || feature.geometry.type !== "Point")
      return cursorCoordinates;

    return feature.geometry.coordinates;
  };

  const handlers: Handlers = {
    click: (e) => {
      const isStarting =
        selection.type === "none" || selection.type === "folder";
      const isAddingVertex = selection.type === "single";

      const clickPosition = isShiftHeld
        ? getMapCoord(e)
        : getSnappingCoordinates(e);

      if (isStarting) {
        const extensionFeature = createExtensionFeature(
          clickPosition,
          clickPosition,
        );

        drawingStart.current = clickPosition as Pos2;
        selectFeature(extensionFeature.id);
        setDrawingState([extensionFeature]);
        return;
      }

      if (isAddingVertex && !!drawingStart.current) {
        const wrappedFeature = featureMap.get(selection.id);

        if (!wrappedFeature) {
          const newFeature = createExtensionFeature(
            drawingStart.current,
            clickPosition,
          );
          selectFeature(newFeature.id);
          transact({
            note: "Created pipe",
            putFeatures: [newFeature],
          }).catch((e) => captureError(e));
        } else {
          if (!isAlreadyLastVertex(wrappedFeature, clickPosition)) {
            const updatedLineString = extendLineString(
              wrappedFeature,
              clickPosition,
            );
            transact({
              note: "Added pipe vertex",
              putFeatures: [updatedLineString],
            }).catch((e) => captureError(e));
          }
        }

        resetDrawingState();
        drawingStart.current = clickPosition as Pos2;
      }
    },
    move: (e) => {
      if (selection.type !== "single") return;

      const isApplePencil = e.type === "mousemove" && usingTouchEvents.current;
      if (isApplePencil) {
        return;
      }

      if (!drawingStart.current) return;

      const nextCoordinates = isShiftHeld
        ? getMapCoord(e)
        : getSnappingCoordinates(e);

      const extensionFeature = createExtensionFeature(
        drawingStart.current,
        nextCoordinates,
      );

      setDrawingState([extensionFeature]);
    },
    double: (e) => {
      if (selection?.type !== "single") return;

      e.preventDefault();

      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      resetDrawingState();
    },
    exit() {
      setMode({ mode: Mode.NONE });

      if (selection.type !== "single") return;

      resetDrawingState();
    },
    touchstart: (e) => {
      usingTouchEvents.current = true;
      e.preventDefault();
    },

    touchmove: (e) => {
      handlers.move(e);
    },

    touchend: (e) => {
      handlers.click(e);
    },

    down: (e) => {
      if (e.type === "mousedown") {
        usingTouchEvents.current = false;
      }
    },
    up() {
      dragTargetRef.current = null;
      setCursor(CURSOR_DEFAULT);
    },
  };

  return handlers;
}
