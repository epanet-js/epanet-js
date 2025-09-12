import type { HandlerContext, Position } from "src/types";
import noop from "lodash/noop";
import { modeAtom, Mode } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { useKeyboardState } from "src/keyboard";
import measureLength from "@turf/length";
import { useSnapping } from "./snapping";
import { useDrawingState } from "./draw-link-state";
import { captureError } from "src/infra/error-tracking";
import { nextTick } from "process";
import { AssetId, LinkAsset, NodeAsset } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { LinkType } from "src/hydraulic-model";
import { addLink } from "src/hydraulic-model/model-operations";
import { useElevations } from "src/map/elevations/use-elevations";
import { LngLat } from "mapbox-gl";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useDrawLinkHandlersDeprecated } from "./draw-link-handlers-deprecated";
import { SnappingCandidate } from "./draw-link-state";
import { usePipeSnapping } from "../draw-node/pipe-snapping";

export function useDrawLinkHandlers(
  context: HandlerContext & { linkType: LinkType },
): Handlers {
  const isSnappingOn = useFeatureFlag("FLAG_SNAPPING");

  const newHandlers = useDrawLinkHandlersNew(context);
  const deprecatedHandlers = useDrawLinkHandlersDeprecated(context);

  return isSnappingOn ? newHandlers : deprecatedHandlers;
}

function useDrawLinkHandlersNew({
  rep,
  hydraulicModel,
  map,
  idMap,
  linkType,
}: HandlerContext & { linkType: LinkType }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const usingTouchEvents = useRef<boolean>(false);
  const { assetBuilder, units } = hydraulicModel;
  const { resetDrawing, drawing, setDrawing, setSnappingCandidate } =
    useDrawingState(assetBuilder, linkType);
  const { getSnappingNode } = useSnapping(map, idMap, hydraulicModel.assets);
  const { findNearestPipeToSnap } = usePipeSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const startDrawing = ({
    startNode,
    startPipeId,
  }: {
    startNode: NodeAsset;
    startPipeId?: AssetId;
  }) => {
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
      startPipeId,
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
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);

  const isClickInProgress = useRef<boolean>(false);

  const getSnappingCandidate = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): SnappingCandidate | null => {
    let snappingCandidate: SnappingCandidate | null = null;
    if (isSnapping()) {
      const snappingNode = getSnappingNode(e);
      if (snappingNode) {
        snappingCandidate = snappingNode;
      } else {
        const snappingPipeResult = findNearestPipeToSnap(
          e.point,
          getMapCoord(e),
        );
        if (snappingPipeResult) {
          snappingCandidate = {
            type: "pipe",
            id: snappingPipeResult.pipeId,
            coordinates: snappingPipeResult.snapPosition,
          };
        }
      }
    }
    return snappingCandidate;
  };

  const handlers: Handlers = {
    click: (e) => {
      isClickInProgress.current = true;

      const doAsyncClick = async () => {
        const snappingCandidate = isSnapping() ? getSnappingCandidate(e) : null;
        const clickPosition = snappingCandidate
          ? snappingCandidate.coordinates
          : getMapCoord(e);
        const pointElevation =
          snappingCandidate && snappingCandidate.type !== "pipe"
            ? snappingCandidate.elevation
            : await fetchElevation(e.lngLat);

        if (drawing.isNull) {
          if (snappingCandidate) {
            if (snappingCandidate.type === "pipe") {
              const startNode = assetBuilder.buildJunction({
                label: "",
                coordinates: snappingCandidate.coordinates,
                elevation: await fetchElevation(
                  coordinatesToLngLat(snappingCandidate.coordinates) as LngLat,
                ),
              });
              return startDrawing({
                startNode,
                startPipeId: snappingCandidate.id,
              });
            } else {
              return startDrawing({ startNode: snappingCandidate });
            }
          } else {
            return startDrawing({
              startNode: assetBuilder.buildJunction({
                label: "",
                coordinates: clickPosition,
                elevation: pointElevation,
              }),
            });
          }
        }

        if (snappingCandidate) {
          const endNode = submitLink(
            drawing.startNode,
            drawing.link,
            snappingCandidate.type === "pipe"
              ? assetBuilder.buildJunction({
                  label: "",
                  coordinates: clickPosition,
                  elevation: pointElevation,
                })
              : snappingCandidate,
          );
          isEndAndContinueOn() && endNode
            ? startDrawing({ startNode: endNode })
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
          endJunction && startDrawing({ startNode: endJunction });
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

      void prefetchTile(e.lngLat);

      const snappingCandidate = isSnapping() ? getSnappingCandidate(e) : null;

      if (drawing.isNull) {
        setSnappingCandidate(snappingCandidate);
        return;
      }

      const nextCoordinates =
        (snappingCandidate && snappingCandidate.coordinates) || getMapCoord(e);

      const linkCopy = drawing.link.copy();
      linkCopy.extendTo(nextCoordinates);

      setDrawing({
        startNode: drawing.startNode,
        link: linkCopy,
        snappingCandidate: !linkCopy.isStart(nextCoordinates)
          ? snappingCandidate
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
        elevation: await fetchElevation(
          coordinatesToLngLat(link.lastVertex) as LngLat,
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
    up: noop,
  };

  return handlers;
}
