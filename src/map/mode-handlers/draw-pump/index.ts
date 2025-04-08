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
import { addPump } from "src/hydraulic-model/model-operations";
import {
  fetchElevationForPoint,
  prefetchElevationsTile,
} from "src/map/elevations";
import { captureError } from "src/infra/error-tracking";
import { nextTick } from "process";
import { NodeAsset, Pump } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";

export function useDrawPumpHandlers({
  rep,
  hydraulicModel,
  map,
  idMap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const usingTouchEvents = useRef<boolean>(false);
  const { assetBuilder, units } = hydraulicModel;
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState(assetBuilder);
  const { getSnappingNode } = useSnapping(map, idMap, hydraulicModel.assets);

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = startNode.coordinates;
    const pump = assetBuilder.buildPump({
      label: "",
      coordinates: [coordinates, coordinates],
    });

    setDrawing({
      startNode,
      pump,
      snappingCandidate: null,
    });
    return pump.id;
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    const pumpCopy = drawing.pump.copy();
    pumpCopy.addVertex(coordinates);
    setDrawing({
      startNode: drawing.startNode,
      pump: pumpCopy,
      snappingCandidate: null,
    });
  };

  const submitPump = (startNode: NodeAsset, pump: Pump, endNode: NodeAsset) => {
    const length = measureLength(pump.feature);
    if (!length) {
      return;
    }

    const moment = addPump(hydraulicModel, { pump, startNode, endNode });

    userTracking.capture({ name: "asset.created", type: "pump" });
    transact(moment);

    const [, , endNodeUpdated] = moment.putAssets || [];
    return endNodeUpdated as NodeAsset;
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
          const endNode = submitPump(
            drawing.startNode,
            drawing.pump,
            snappingNode,
          );
          isEndAndContinueOn() && endNode
            ? startDrawing(endNode)
            : resetDrawing();
          return;
        }

        if (isEndAndContinueOn()) {
          let endJunction: NodeAsset | undefined = assetBuilder.buildJunction({
            label: "",
            coordinates: clickPosition,
            elevation: pointElevation,
          });
          endJunction = submitPump(
            drawing.startNode,
            drawing.pump,
            endJunction,
          );
          endJunction && startDrawing(endJunction);
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

      const pumpCopy = drawing.pump.copy();
      pumpCopy.extendTo(nextCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        pump: pumpCopy,
        snappingCandidate: !pumpCopy.isStart(nextCoordinates)
          ? snappingNode
          : null,
      });
    },
    double: async (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, pump } = drawing;

      const endJunction: NodeAsset | undefined = assetBuilder.buildJunction({
        label: "",
        coordinates: pump.lastVertex,
        elevation: await fetchElevationForPoint(
          coordinatesToLngLat(pump.lastVertex),
          {
            unit: units.elevation,
          },
        ),
      });

      submitPump(startNode, pump, endJunction);
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
