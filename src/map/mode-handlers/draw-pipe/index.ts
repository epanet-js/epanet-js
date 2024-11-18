import type { HandlerContext, Position } from "src/types";
import { modeAtom, Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { useKeyboardState } from "src/keyboard";
import measureLength from "@turf/length";
import {
  NodeAsset,
  Pipe,
  addVertexToLink,
  createJunction,
  createPipe,
  extendLink,
  getNodeCoordinates,
  getNodeElevation,
  isLinkStart,
} from "src/hydraulics/assets";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./drawing-state";
import { addPipe } from "src/hydraulics/model-operations";
import {
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "src/map/elevations";
import { captureError } from "src/infra/error-tracking";
import { isFeatureOn } from "src/infra/feature-flags";

export function useDrawPipeHandlers({
  rep,
  hydraulicModel,
  map,
  idMap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const usingTouchEvents = useRef<boolean>(false);
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState();
  const { getSnappingNode } = useSnapping(map, idMap, hydraulicModel.assets);

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = getNodeCoordinates(startNode);
    const pipe = createPipe([...[coordinates], ...[coordinates]]);

    setDrawing({
      startNode,
      pipe,
      snappingCandidate: null,
    });
    return pipe.id;
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    setDrawing({
      startNode: drawing.startNode,
      pipe: addVertexToLink(drawing.pipe, coordinates),
      snappingCandidate: null,
    });
  };

  const submitPipe = (startNode: NodeAsset, pipe: Pipe, endNode: NodeAsset) => {
    const length = measureLength(pipe.feature);
    if (!length) {
      return;
    }

    const moment = addPipe(hydraulicModel, { pipe, startNode, endNode });

    transact(moment);
  };

  const isSnapping = () => !isShiftHeld();
  const isEndAndContinueOn = isControlHeld;

  const coordinatesToLngLat = (coordinates: Position) => {
    const [lng, lat] = coordinates;
    return { lng, lat };
  };

  const isClickInProgress = useRef<boolean>(false);

  const handlers: Handlers = {
    click: (e) => {
      if (isFeatureOn("FLAG_ELEVATIONS")) {
        isClickInProgress.current = true;

        const doAsyncClick = async () => {
          const snappingNode = isSnapping() ? getSnappingNode(e) : null;
          const clickPosition = snappingNode
            ? getNodeCoordinates(snappingNode)
            : getMapCoord(e);
          const pointElevation = snappingNode
            ? getNodeElevation(snappingNode)
            : isFeatureOn("FLAG_ELEVATIONS")
              ? await fetchElevationForPoint(e.lngLat)
              : 0;

          if (drawing.isNull) {
            const startNode = snappingNode
              ? snappingNode
              : createJunction({
                  coordinates: clickPosition,
                  elevation: pointElevation,
                });

            startDrawing(startNode);

            return;
          }

          if (!!snappingNode) {
            submitPipe(drawing.startNode, drawing.pipe, snappingNode);
            isEndAndContinueOn() ? startDrawing(snappingNode) : resetDrawing();
            return;
          }

          if (isEndAndContinueOn()) {
            const endJunction = createJunction({
              coordinates: clickPosition,
              elevation: pointElevation,
            });
            submitPipe(drawing.startNode, drawing.pipe, endJunction);
            startDrawing(endJunction);
          } else {
            addVertex(clickPosition);
          }
        };

        doAsyncClick()
          .then(() => {
            setTimeout(() => (isClickInProgress.current = false), 10);
          })
          .catch((error) => {
            captureError(error);
            setTimeout(() => (isClickInProgress.current = false), 10);
          });
      } else {
        const snappingNode = isSnapping() ? getSnappingNode(e) : null;
        const clickPosition = snappingNode
          ? getNodeCoordinates(snappingNode)
          : getMapCoord(e);

        if (drawing.isNull) {
          const startNode = snappingNode
            ? snappingNode
            : createJunction({
                coordinates: clickPosition,
                elevation: 0,
              });

          startDrawing(startNode);

          return;
        }

        if (!!snappingNode) {
          submitPipe(drawing.startNode, drawing.pipe, snappingNode);
          isEndAndContinueOn() ? startDrawing(snappingNode) : resetDrawing();
          return;
        }

        if (isEndAndContinueOn()) {
          const endJunction = createJunction({
            coordinates: clickPosition,
            elevation: 0,
          });
          submitPipe(drawing.startNode, drawing.pipe, endJunction);
          startDrawing(endJunction);
        } else {
          addVertex(clickPosition);
        }
      }
    },
    move: (e) => {
      if (isClickInProgress.current) return;

      const isApplePencil = e.type === "mousemove" && usingTouchEvents.current;
      if (isApplePencil) {
        return;
      }

      prefetchElevationsTile(e.lngLat).catch(captureError);

      const snappingNode = isSnapping() ? getSnappingNode(e) : null;

      if (drawing.isNull) {
        setSnappingCandidate(snappingNode);
        return;
      }

      const nextCoordinates =
        (snappingNode && getNodeCoordinates(snappingNode)) || getMapCoord(e);

      const isPipeStart = isLinkStart(drawing.pipe, nextCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        pipe: extendLink(drawing.pipe, nextCoordinates),
        snappingCandidate: !isPipeStart ? snappingNode : null,
      });
    },
    double: async (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, pipe } = drawing;
      if (!pipe.feature.geometry) return;
      const geometry = pipe.feature.geometry;
      const lastVertex = geometry.coordinates.at(-1);
      if (!lastVertex) return;

      const endJunction = createJunction({
        coordinates: lastVertex,
        elevation: isFeatureOn("FLAG_ELEVATIONS")
          ? await fetchElevationForPoint(coordinatesToLngLat(lastVertex))
          : 0,
      });

      submitPipe(startNode, pipe, endJunction);
      resetDrawing();
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
