import type {
  HandlerContext,
  IWrappedFeature,
  LineString,
  Position,
} from "src/types";
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
} from "src/hydraulics/assets";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./drawing-state";

export function useDrawPipeHandlers({
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
  const { resetDrawing, drawing, setDrawing } = useDrawingState();
  const { getSnappingNode, getSnappingCoordinates } = useSnapping(
    pmap,
    idMap,
    featureMap,
  );

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = getNodeCoordinates(startNode);
    const pipe = createPipe([coordinates, coordinates]);

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
      line: extendLink(drawing.line as Pipe, coordinates),
    });
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    setDrawing({
      startNode: drawing.startNode,
      line: addVertexToLink(drawing.line as Pipe, coordinates),
    });
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
        ? getNodeCoordinates(snappingNode)
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
