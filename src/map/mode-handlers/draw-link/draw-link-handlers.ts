import type { HandlerContext, Position } from "src/types";
import { modeAtom, Mode, cursorStyleAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { useKeyboardState } from "src/keyboard";
import measureLength from "@turf/length";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./draw-link-state";
import {
  fetchElevationForPointDeprecated,
  prefetchElevationsTileDeprecated,
} from "src/map/elevations";
import { captureError } from "src/infra/error-tracking";
import { nextTick } from "process";
import { LinkAsset, NodeAsset } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { LinkType } from "src/hydraulic-model";
import { addLink } from "src/hydraulic-model/model-operations";

export function useDrawLinkHandlers({
  rep,
  hydraulicModel,
  map,
  idMap,
  linkType,
}: HandlerContext & { linkType: LinkType }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const usingTouchEvents = useRef<boolean>(false);
  const { assetBuilder, units } = hydraulicModel;
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState(assetBuilder, linkType);
  const { getSnappingNode } = useSnapping(map, idMap, hydraulicModel.assets);

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = (startNode: NodeAsset) => {
    const coordinates = startNode.coordinates;
    const startProperties = {
      label: "",
      coordinates: [coordinates, coordinates],
    };
    let link;
    switch (linkType) {
      case "pipe":
        link = assetBuilder.buildPipe(startProperties);
        break;
      case "pump":
        link = assetBuilder.buildPump(startProperties);
        break;
      case "valve":
        link = assetBuilder.buildValve(startProperties);
        break;
    }

    setDrawing({
      startNode,
      link,
      snappingCandidate: null,
    });
    return link.id;
  };

  const addVertex = (coordinates: Position) => {
    if (drawing.isNull) return;

    const linkCopy = drawing.link.copy();
    linkCopy.addVertex(coordinates);
    setDrawing({
      startNode: drawing.startNode,
      link: linkCopy,
      snappingCandidate: null,
    });
  };

  const submitLink = (
    startNode: NodeAsset,
    link: LinkAsset,
    endNode: NodeAsset,
  ) => {
    const length = measureLength(link.feature);
    if (!length) {
      return;
    }

    const moment = addLink(hydraulicModel, {
      link: link,
      startNode,
      endNode,
    });

    userTracking.capture({ name: "asset.created", type: link.type });
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
          : await fetchElevationForPointDeprecated(e.lngLat, {
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
          const endNode = submitLink(
            drawing.startNode,
            drawing.link,
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
          endJunction = submitLink(
            drawing.startNode,
            drawing.link,
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

      prefetchElevationsTileDeprecated(e.lngLat).catch(captureError);

      const snappingNode = isSnapping() ? getSnappingNode(e) : null;

      if (drawing.isNull) {
        setSnappingCandidate(snappingNode);
        return;
      }

      const nextCoordinates =
        (snappingNode && snappingNode.coordinates) || getMapCoord(e);

      const linkCopy = drawing.link.copy();
      linkCopy.extendTo(nextCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        link: linkCopy,
        snappingCandidate: !linkCopy.isStart(nextCoordinates)
          ? snappingNode
          : null,
      });
    },
    double: async (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      const { startNode, link } = drawing;

      const endJunction: NodeAsset | undefined = assetBuilder.buildJunction({
        label: "",
        coordinates: link.lastVertex,
        elevation: await fetchElevationForPointDeprecated(
          coordinatesToLngLat(link.lastVertex),
          {
            unit: units.elevation,
          },
        ),
      });

      submitLink(startNode, link, endJunction);
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
