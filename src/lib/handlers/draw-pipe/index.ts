import type { HandlerContext, Position } from "src/types";
import { modeAtom, Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { captureError } from "src/infra/error-tracking";
import { useKeyboardState } from "src/keyboard";
import { useSelection } from "src/selection";
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
  selection,
  pmap,
  idMap,
}: HandlerContext): Handlers {
  const { selectFeature } = useSelection(selection);
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
    if (!isFeatureOn("FLAG_MAP_PRO")) selectFeature(pipe.id);

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

    transact(moment).catch((e) => captureError(e));
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

        const pipeId = startDrawing(startNode);
        if (!isFeatureOn("FLAG_MAP_PRO")) selectFeature(pipeId);

        return;
      }

      if (!!snappingNode) {
        submitPipe(drawing.startNode, drawing.pipe, snappingNode);
        isEndAndContinueOn() ? startDrawing(snappingNode) : resetDrawing();
        return;
      }

      if (isEndAndContinueOn()) {
        const endJunction = createJunction(clickPosition);
        submitPipe(drawing.startNode, drawing.pipe, endJunction);
        startDrawing(endJunction);
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
