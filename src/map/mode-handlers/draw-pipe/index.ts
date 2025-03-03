import type { HandlerContext, Position } from "src/types";
import { modeAtom, Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { useKeyboardState } from "src/keyboard";
import measureLength from "@turf/length";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./drawing-state";
import { addPipe } from "src/hydraulic-model/model-operations";
import {
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "src/map/elevations";
import { captureError } from "src/infra/error-tracking";
import { nextTick } from "process";
import { NodeAsset, Pipe } from "src/hydraulic-model";
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
  const { assetBuilder, units } = hydraulicModel;
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState(assetBuilder);
  const { getSnappingNode } = useSnapping(map, idMap, hydraulicModel.assets);

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = startNode.coordinates;
    const pipe = assetBuilder.buildPipe({
      label: isFeatureOn("FLAG_LABEL_TYPE") ? "" : undefined,
      coordinates: [coordinates, coordinates],
    });

    setDrawing({
      startNode,
      pipe,
      snappingCandidate: null,
    });
    return pipe.id;
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    const pipeCopy = drawing.pipe.copy();
    pipeCopy.addVertex(coordinates);
    setDrawing({
      startNode: drawing.startNode,
      pipe: pipeCopy,
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
      isClickInProgress.current = true;

      const doAsyncClick = async () => {
        const snappingNode = isSnapping() ? getSnappingNode(e) : null;
        const clickPosition = snappingNode
          ? snappingNode.coordinates
          : getMapCoord(e);
        const pointElevation = snappingNode
          ? snappingNode.elevation
          : await fetchElevationForPoint(e.lngLat, {
              unit: units.elevation,
            });

        if (drawing.isNull) {
          const startNode = snappingNode
            ? snappingNode
            : assetBuilder.buildJunction({
                label: "",
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
          const endJunction = assetBuilder.buildJunction({
            label: "",
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
          nextTick(() => (isClickInProgress.current = false));
        })
        .catch((error) => {
          captureError(error);
          nextTick(() => (isClickInProgress.current = false));
        });
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
        (snappingNode && snappingNode.coordinates) || getMapCoord(e);

      const pipeCopy = drawing.pipe.copy();
      pipeCopy.extendTo(nextCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        pipe: pipeCopy,
        snappingCandidate: !pipeCopy.isStart(nextCoordinates)
          ? snappingNode
          : null,
      });
    },
    double: async (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, pipe } = drawing;

      const endJunction = assetBuilder.buildJunction({
        label: "",
        coordinates: pipe.lastVertex,
        elevation: await fetchElevationForPoint(
          coordinatesToLngLat(pipe.lastVertex),
          {
            unit: units.elevation,
          },
        ),
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
