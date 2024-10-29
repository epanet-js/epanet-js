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
import { useAtom, useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "./utils";
import { useRef } from "react";
import { captureError } from "src/infra/error-tracking";
import { decodeId, newFeatureId } from "../id";
import { useKeyboardState } from "src/keyboard";
import { FEATURES_POINT_LAYER_NAME } from "../load_and_augment_style";
import { MapMouseEvent, MapTouchEvent, PointLike } from "mapbox-gl";
import { UIDMap } from "../id_mapper";
import { useSelection } from "src/selection";
import measureLength from "@turf/length";

const createLineString = (start: Position, end: Position) => {
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
  const coordinates = feature.geometry.coordinates.slice(0, -1);

  return {
    ...wrappedFeature,
    feature: replaceCoordinates(feature, coordinates.concat([position])),
  };
};

const addVertexToLineString = (
  wrappedFeature: IWrappedFeature,
  position: Position,
) => {
  const feature = wrappedFeature.feature as IFeature<LineString>;
  const coordinates = feature.geometry.coordinates;
  return {
    ...wrappedFeature,
    feature: replaceCoordinates(feature, coordinates.concat([position])),
  };
};

type NullDrawing = { isNull: true };
type DrawingState =
  | {
      isNull: false;
      startNode: IWrappedFeature;
      line: IWrappedFeature;
    }
  | NullDrawing;

const useLineDrawingState = () => {
  const startNodeRef = useRef<IWrappedFeature | null>(null);
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const startLineDrawing = (startNode: IWrappedFeature) => {
    const geometry = startNode.feature.geometry;
    if (!geometry || geometry.type !== "Point")
      throw new Error("Invalid geometry");

    const position = geometry.coordinates;
    startNodeRef.current = startNode;
    const line = createLineString(position, position);
    setEphemeralState({
      type: "drawLine",
      line,
    });
    return line.id;
  };

  const extendLine = (position: Position) => {
    setEphemeralState((prev) => {
      return {
        type: "drawLine",
        line:
          prev.type === "drawLine"
            ? extendLineString(prev.line, position)
            : createLineString(position, position),
      };
    });
  };

  const addVertex = (position: Position) => {
    setEphemeralState((prev) => {
      return {
        type: "drawLine",
        line:
          prev.type === "drawLine"
            ? addVertexToLineString(prev.line, position)
            : createLineString(position, position),
      };
    });
  };

  const resetDrawing = () => {
    startNodeRef.current = null;
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    startNodeRef.current && state.type === "drawLine"
      ? { isNull: false, startNode: startNodeRef.current, line: state.line }
      : { isNull: true };

  return {
    startLineDrawing,
    addVertex,
    extendLine,
    resetDrawing,
    drawing: drawingState,
  };
};

export function usePipeHandlers({
  rep,
  featureMap,
  selection,
  pmap,
  idMap,
  mode,
}: HandlerContext): Handlers {
  const { selectFeature } = useSelection(selection);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const usingTouchEvents = useRef<boolean>(false);
  const { startLineDrawing, extendLine, resetDrawing, addVertex, drawing } =
    useLineDrawingState();

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const createJunction = (position: Position, id = newFeatureId()) => {
    return {
      id,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: position,
        },
      } as Feature,
      folderId: null,
      at: "any",
    };
  };

  const getNeighborPoint = (point: mapboxgl.Point): string | null => {
    const { x, y } = point;
    const distance = 12;

    const searchBox = [
      [x - distance, y - distance] as PointLike,
      [x + distance, y + distance] as PointLike,
    ] as [PointLike, PointLike];

    const pointFeatures = pmap.map.queryRenderedFeatures(searchBox, {
      layers: [FEATURES_POINT_LAYER_NAME],
    });
    if (!pointFeatures.length) return null;

    const id = pointFeatures[0].id;
    const decodedId = decodeId(id as RawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    return uuid;
  };

  const getSnappingNode = (
    e: MapMouseEvent | MapTouchEvent,
  ): IWrappedFeature | null => {
    const featureId = getNeighborPoint(e.point);
    if (!featureId) return null;

    const wrappedFeature = featureMap.get(featureId);
    return wrappedFeature || null;
  };

  const getSnappingCoordinates = (
    e: MapMouseEvent | MapTouchEvent,
  ): Position => {
    const cursorCoordinates = getMapCoord(e);

    const featureId = getNeighborPoint(e.point);
    if (!featureId) return cursorCoordinates;

    const wrappedFeature = featureMap.get(featureId);
    if (!wrappedFeature) return cursorCoordinates;

    const { feature } = wrappedFeature;
    if (!feature.geometry || feature.geometry.type !== "Point")
      return cursorCoordinates;

    return feature.geometry.coordinates;
  };

  const getPointCoordinates = (wrappedFeature: IWrappedFeature): Position => {
    const { feature } = wrappedFeature;
    if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
      throw new Error("Feature is not a valid point");
    }

    return feature.geometry.coordinates;
  };

  const finish = () => {
    resetDrawing();
    const { modeOptions } = mode;
    if (modeOptions && modeOptions.multi) return;

    setMode({ mode: Mode.NONE });
  };

  const createPipe = (
    startNode: IWrappedFeature,
    line: IWrappedFeature,
    endNode: IWrappedFeature,
  ) => {
    const length = measureLength(line.feature);
    if (!length) return;

    transact({
      note: "Created pipe",
      putFeatures: [startNode, line, endNode],
    }).catch((e) => captureError(e));
  };

  const isSnapping = !isShiftHeld;

  const handlers: Handlers = {
    click: (e) => {
      const snappingNode = isSnapping ? getSnappingNode(e) : null;
      const clickPosition = snappingNode
        ? getPointCoordinates(snappingNode)
        : getMapCoord(e);

      if (drawing.isNull) {
        const startNode = snappingNode
          ? snappingNode
          : createJunction(clickPosition);

        if (isControlHeld() && !snappingNode) {
          transact({
            note: "Create junction",
            putFeatures: [startNode],
          });
        }

        const id = startLineDrawing(startNode);

        selectFeature(id);
        return;
      }

      if (!!snappingNode) {
        createPipe(drawing.startNode, drawing.line, snappingNode);
        isControlHeld() ? startLineDrawing(snappingNode) : finish();
        return;
      }

      if (isControlHeld()) {
        const endJunction = createJunction(clickPosition);
        createPipe(drawing.startNode, drawing.line, endJunction);
        startLineDrawing(endJunction);
      } else {
        addVertex(clickPosition);
      }
    },
    move: (e) => {
      if (drawing.isNull) return;

      const isApplePencil = e.type === "mousemove" && usingTouchEvents.current;
      if (isApplePencil) {
        return;
      }

      const nextCoordinates = isShiftHeld
        ? getMapCoord(e)
        : getSnappingCoordinates(e);

      extendLine(nextCoordinates);
    },
    double: (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, line } = drawing;
      if (!line.feature.geometry) return;
      const geometry = line.feature.geometry as LineString;
      const lastVertex = geometry.coordinates.at(-1);
      if (!lastVertex) return;

      const endJunction = createJunction(lastVertex);

      createPipe(startNode, line, endJunction);
      finish();
    },
    exit() {
      resetDrawing();
      setMode({ mode: Mode.NONE });
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
      setCursor(CURSOR_DEFAULT);
    },
  };

  return handlers;
}
