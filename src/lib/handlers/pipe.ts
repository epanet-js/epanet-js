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
import { NodeAsset, createJunction } from "src/hydraulics/assets";

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
      startNode: NodeAsset;
      line: IWrappedFeature;
    }
  | NullDrawing;

const useLineDrawingState = () => {
  const startNodeRef = useRef<NodeAsset | null>(null);
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const resetDrawing = () => {
    startNodeRef.current = null;
    setEphemeralState({ type: "none" });
  };

  const drawingState: DrawingState =
    startNodeRef.current && state.type === "drawLine"
      ? { isNull: false, startNode: startNodeRef.current, line: state.line }
      : { isNull: true };

  const setDrawing = ({
    startNode,
    line,
  }: {
    startNode: NodeAsset;
    line: IWrappedFeature;
  }) => {
    startNodeRef.current = startNode;
    setEphemeralState({
      type: "drawLine",
      line: line,
    });
  };

  return {
    resetDrawing,
    setDrawing,
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
  const { resetDrawing, drawing, setDrawing } = useLineDrawingState();

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = startNode.feature.geometry.coordinates;
    const pipe = createLineString(coordinates, coordinates);

    setDrawing({
      startNode,
      line: pipe,
    });
    return pipe.id;
  };

  const extendPipe = (coordinates: Position) => {
    if (drawing.isNull) return;

    setDrawing({
      startNode: drawing.startNode,
      line: extendLineString(drawing.line, coordinates),
    });
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    setDrawing({
      startNode: drawing.startNode,
      line: addVertexToLineString(drawing.line, coordinates),
    });
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
  ): NodeAsset | null => {
    const featureId = getNeighborPoint(e.point);
    if (!featureId) return null;

    const wrappedFeature = featureMap.get(featureId);
    if (!wrappedFeature) return null;

    const geometry = wrappedFeature.feature.geometry;
    if (!geometry || geometry.type !== "Point") return null;

    return wrappedFeature as NodeAsset;
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

  const submitPipe = (
    startNode: NodeAsset,
    line: IWrappedFeature,
    endNode: NodeAsset,
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

        const pipeId = startDrawing(startNode);
        selectFeature(pipeId);

        return;
      }

      if (!!snappingNode) {
        submitPipe(drawing.startNode, drawing.line, snappingNode);
        isControlHeld() ? startDrawing(snappingNode) : finish();
        return;
      }

      if (isControlHeld()) {
        const endJunction = createJunction(clickPosition);
        submitPipe(drawing.startNode, drawing.line, endJunction);
        startDrawing(endJunction);
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

      extendPipe(nextCoordinates);
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

      submitPipe(startNode, line, endJunction);
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
