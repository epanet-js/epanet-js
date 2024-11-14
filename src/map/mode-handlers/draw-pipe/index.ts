import type { HandlerContext, Position } from "src/types";
import { modeAtom, Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { captureError } from "src/infra/error-tracking";
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
  isLinkStart,
} from "src/hydraulics/assets";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./drawing-state";
import { addPipe } from "src/hydraulics/model-operations";
import { isFeatureOn } from "src/infra/feature-flags";

export function useDrawPipeHandlers({
  rep,
  hydraulicModel,
  pmap,
  idMap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const usingTouchEvents = useRef<boolean>(false);
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState();
  const { getSnappingNode, getSnappingCoordinates } = useSnapping(
    pmap,
    idMap,
    hydraulicModel.assets,
  );

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = getNodeCoordinates(startNode);
    const pipe = createPipe([coordinates, coordinates]);

    setDrawing({
      startNode,
      pipe,
    });
    return pipe.id;
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    setDrawing({
      startNode: drawing.startNode,
      pipe: addVertexToLink(drawing.pipe, coordinates),
      snappingCoordinates: null,
    });
  };

  const submitPipe = (startNode: NodeAsset, pipe: Pipe, endNode: NodeAsset) => {
    const length = measureLength(pipe.feature);
    if (!length) return;

    const moment = addPipe(hydraulicModel, { pipe, startNode, endNode });

    transact(moment);
  };

  const submitPipeDeprecated = async (
    startNode: NodeAsset,
    pipe: Pipe,
    endNode: NodeAsset,
  ) => {
    try {
      const length = measureLength(pipe.feature);
      if (!length) return;

      const moment = addPipe(hydraulicModel, { pipe, startNode, endNode });

      await transact(moment);
    } catch (e) {
      captureError(e as Error);
    }
  };

  const isSnapping = () => !isShiftHeld();
  const isEndAndContinueOn = isControlHeld;

  const handlers: Handlers = {
    click: (e) => {
      const snappingNode = isSnapping() ? getSnappingNode(e) : null;
      const clickPosition = snappingNode
        ? getNodeCoordinates(snappingNode)
        : getMapCoord(e);

      if (drawing.isNull) {
        const startNode = snappingNode
          ? snappingNode
          : createJunction(clickPosition);

        startDrawing(startNode);

        return;
      }

      if (!!snappingNode) {
        if (isFeatureOn("FLAG_SPLIT_SOURCES")) {
          submitPipe(drawing.startNode, drawing.pipe, snappingNode);
          isEndAndContinueOn() ? startDrawing(snappingNode) : resetDrawing();
        } else {
          submitPipeDeprecated(drawing.startNode, drawing.pipe, snappingNode)
            .then(() => {
              isEndAndContinueOn()
                ? startDrawing(snappingNode)
                : resetDrawing();
            })
            .catch((e) => captureError(e));
        }
        return;
      }

      if (isEndAndContinueOn()) {
        const endJunction = createJunction(clickPosition);
        if (isFeatureOn("FLAG_SPLIT_SOURCES")) {
          submitPipe(drawing.startNode, drawing.pipe, endJunction);
          startDrawing(endJunction);
        } else {
          submitPipeDeprecated(drawing.startNode, drawing.pipe, endJunction)
            .then(() => {
              startDrawing(endJunction);
            })
            .catch((e) => captureError(e));
        }
      } else {
        addVertex(clickPosition);
      }
    },
    move: (e) => {
      const isApplePencil = e.type === "mousemove" && usingTouchEvents.current;
      if (isApplePencil) {
        return;
      }

      const snappingCoordinates = isSnapping()
        ? getSnappingCoordinates(e)
        : null;

      if (drawing.isNull) {
        setSnappingCandidate(snappingCoordinates);
        return;
      }

      const nextCoordinates = snappingCoordinates || getMapCoord(e);

      const isPipeStart =
        snappingCoordinates && isLinkStart(drawing.pipe, snappingCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        pipe: extendLink(drawing.pipe, nextCoordinates),
        snappingCoordinates: !isPipeStart ? snappingCoordinates : null,
      });
    },
    double: (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, pipe } = drawing;
      if (!pipe.feature.geometry) return;
      const geometry = pipe.feature.geometry;
      const lastVertex = geometry.coordinates.at(-1);
      if (!lastVertex) return;

      const endJunction = createJunction(lastVertex);

      if (isFeatureOn("FLAG_SPLIT_SOURCES")) {
        submitPipe(startNode, pipe, endJunction);
        resetDrawing();
      } else {
        submitPipeDeprecated(startNode, pipe, endJunction)
          .then(() => {
            resetDrawing();
          })
          .catch((e) => captureError(e));
      }
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
