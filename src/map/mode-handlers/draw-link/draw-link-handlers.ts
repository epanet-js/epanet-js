import type { HandlerContext, Position } from "src/types";
import noop from "lodash/noop";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  EphemeralEditingState,
  selectionAtom,
} from "src/state/jotai";
import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { getMapCoord } from "../utils";
import { useRef } from "react";
import { useKeyboardState } from "src/keyboard";
import measureLength from "@turf/length";
import { useSnapping } from "../hooks/use-snapping";
import { captureError } from "src/infra/error-tracking";
import { nextTick } from "process";
import { AssetId, LinkAsset, NodeAsset } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { LinkType } from "src/hydraulic-model";
import { addLink } from "src/hydraulic-model/model-operations";
import { useElevations } from "src/map/elevations/use-elevations";
import { LngLat } from "mapbox-gl";
import { useSelection } from "src/selection";

export type SnappingCandidate =
  | NodeAsset
  | {
      type: "pipe";
      id: AssetId;
      coordinates: Position;
      vertexIndex: number | null;
    };

export type SubmitLinkParams = {
  startNode: NodeAsset;
  link: LinkAsset;
  endNode: NodeAsset;
  startPipeId?: AssetId;
  endPipeId?: AssetId;
};

type NullDrawing = {
  isNull: true;
  snappingCandidate: SnappingCandidate | null;
};

type DrawingState =
  | {
      isNull: false;
      startNode: NodeAsset;
      startPipeId?: AssetId;
      link: LinkAsset;
      snappingCandidate: SnappingCandidate | null;
    }
  | NullDrawing;

export function useDrawLinkHandlers({
  rep,
  hydraulicModel,
  map,
  idMap,
  linkType,
  sourceLink,
  onSubmitLink,
  disableEndAndContinue,
}: HandlerContext & {
  linkType: LinkType;
  sourceLink?: LinkAsset;
  onSubmitLink?: (params: SubmitLinkParams) => NodeAsset | undefined;
  disableEndAndContinue?: boolean;
}): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);
  const { selectAsset } = useSelection(selection);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const usingTouchEvents = useRef<boolean>(false);
  const { assetBuilder, units } = hydraulicModel;
  const { findSnappingCandidate } = useSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const { isShiftHeld, isControlHeld } = useKeyboardState();

  const createLinkForType = (coordinates: Position[] = []) => {
    const startProperties = {
      label: "",
      coordinates,
    };
    switch (linkType) {
      case "pipe":
        return assetBuilder.buildPipe(startProperties);
      case "pump":
        return assetBuilder.buildPump(startProperties);
      case "valve":
        return assetBuilder.buildValve(startProperties);
    }
  };

  const resetDrawing = () => {
    setEphemeralState({ type: "none" });
  };

  const getDrawingState = (): DrawingState => {
    if (ephemeralState.type === "drawLink" && ephemeralState.startNode) {
      return {
        isNull: false,
        startNode: ephemeralState.startNode,
        startPipeId: ephemeralState.startPipeId,
        snappingCandidate: ephemeralState.snappingCandidate || null,
        link: ephemeralState.link as LinkAsset,
      };
    }
    return {
      isNull: true,
      snappingCandidate:
        ephemeralState.type === "drawLink"
          ? ephemeralState.snappingCandidate
          : null,
    };
  };

  const setDrawing = ({
    startNode,
    link,
    snappingCandidate,
    startPipeId,
    draftJunction,
  }: {
    startNode: NodeAsset;
    link: LinkAsset;
    snappingCandidate: SnappingCandidate | null;
    startPipeId?: AssetId;
    draftJunction?: NodeAsset;
  }) => {
    setEphemeralState({
      type: "drawLink",
      link,
      linkType,
      startNode,
      startPipeId,
      snappingCandidate,
      ...(sourceLink && { sourceLink }),
      ...(draftJunction && { draftJunction }),
    });
  };

  const setSnappingCandidate = (
    snappingCandidate: SnappingCandidate | null,
  ) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "drawLink") {
        const link = createLinkForType();

        return {
          type: "drawLink",
          linkType,
          link,
          snappingCandidate,
          ...(sourceLink && { sourceLink }),
        };
      }

      if (prev.snappingCandidate === snappingCandidate) {
        return prev;
      }

      return {
        ...prev,
        snappingCandidate,
      };
    });
  };

  const drawing = getDrawingState();

  const startDrawing = ({
    startNode,
    startPipeId,
  }: {
    startNode: NodeAsset;
    startPipeId?: AssetId;
  }) => {
    const coordinates = startNode.coordinates;
    const link = sourceLink ? sourceLink.copy() : createLinkForType();
    link.setCoordinates([coordinates, coordinates]);

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
      startPipeId: drawing.startPipeId,
      link: linkCopy,
      snappingCandidate: null,
    });
  };

  const submitLink = ({
    startNode,
    link,
    endNode,
    startPipeId,
    endPipeId,
  }: {
    startNode: NodeAsset;
    link: LinkAsset;
    endNode: NodeAsset;
    startPipeId?: AssetId;
    endPipeId?: AssetId;
  }) => {
    const length = measureLength(link.feature);
    if (!length) {
      return;
    }

    const moment = addLink(hydraulicModel, {
      link: link,
      startNode,
      endNode,
      startPipeId,
      endPipeId,
    });

    userTracking.capture({ name: "asset.created", type: link.type });
    transact(moment);

    if (moment.putAssets && moment.putAssets.length > 0) {
      const newLinkId = moment.putAssets[0].id;
      selectAsset(newLinkId);
    }

    const [, , endNodeUpdated] = moment.putAssets || [];
    return endNodeUpdated as NodeAsset;
  };

  const isSnapping = () => !isShiftHeld();
  const isEndAndContinueOn = disableEndAndContinue
    ? () => false
    : isControlHeld;

  const coordinatesToLngLat = (coordinates: Position) => {
    const [lng, lat] = coordinates;
    return { lng, lat };
  };
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);

  const isClickInProgress = useRef<boolean>(false);

  const createJunction = (coordinates: Position, elevation: number) =>
    assetBuilder.buildJunction({
      label: "",
      coordinates,
      elevation,
    });

  const handleSnappingClick = async (
    snappingCandidate: SnappingCandidate,
    clickPosition: Position,
    pointElevation: number,
  ) => {
    if (drawing.isNull) {
      if (snappingCandidate.type === "pipe") {
        const startNode = createJunction(
          snappingCandidate.coordinates,
          await fetchElevation(
            coordinatesToLngLat(snappingCandidate.coordinates) as LngLat,
          ),
        );
        startDrawing({
          startNode,
          startPipeId: snappingCandidate.id,
        });
      } else {
        startDrawing({
          startNode: snappingCandidate,
        });
      }
    } else {
      const submitParams = {
        startNode: drawing.startNode,
        startPipeId: drawing.startPipeId,
        link: drawing.link,
        endNode:
          snappingCandidate.type === "pipe"
            ? createJunction(clickPosition, pointElevation)
            : snappingCandidate,
        endPipeId:
          snappingCandidate.type === "pipe" ? snappingCandidate.id : undefined,
      };
      const endNode = onSubmitLink
        ? onSubmitLink(submitParams)
        : submitLink(submitParams);

      if (isEndAndContinueOn() && endNode) {
        startDrawing({
          startNode: endNode,
        });
      } else {
        resetDrawing();
      }
    }
  };

  const handlers: Handlers = {
    click: (e) => {
      isClickInProgress.current = true;

      const doAsyncClick = async () => {
        if (disableEndAndContinue && isControlHeld()) {
          return;
        }

        const isCurrentlySnapping = isSnapping();
        const snappingCandidate = isCurrentlySnapping
          ? findSnappingCandidate(e, getMapCoord(e))
          : null;
        const clickPosition = snappingCandidate
          ? snappingCandidate.coordinates
          : getMapCoord(e);
        const pointElevation =
          snappingCandidate && snappingCandidate.type !== "pipe"
            ? snappingCandidate.elevation
            : await fetchElevation(e.lngLat);

        if (snappingCandidate) {
          return handleSnappingClick(
            snappingCandidate,
            clickPosition,
            pointElevation,
          );
        }

        if (drawing.isNull) {
          const startNode = createJunction(clickPosition, pointElevation);
          startDrawing({
            startNode,
          });
        } else if (isEndAndContinueOn()) {
          const submitParams = {
            startNode: drawing.startNode,
            startPipeId: drawing.startPipeId,
            link: drawing.link,
            endNode: createJunction(clickPosition, pointElevation),
          };
          const endJunction = onSubmitLink
            ? onSubmitLink(submitParams)
            : submitLink(submitParams);
          if (endJunction) {
            startDrawing({
              startNode: endJunction,
            });
          }
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

      const snappingCandidate = isSnapping()
        ? findSnappingCandidate(e, getMapCoord(e))
        : null;

      if (drawing.isNull) {
        setSnappingCandidate(snappingCandidate);
      } else {
        const nextCoordinates =
          (snappingCandidate && snappingCandidate.coordinates) ||
          getMapCoord(e);

        const linkCopy = drawing.link.copy();
        linkCopy.extendTo(nextCoordinates);

        const shouldShowDraftJunction =
          isEndAndContinueOn() && !snappingCandidate;

        const draftJunction = shouldShowDraftJunction
          ? assetBuilder.buildJunction({
              label: "",
              coordinates: nextCoordinates,
            })
          : undefined;

        setDrawing({
          ...drawing,
          link: linkCopy,
          snappingCandidate: !linkCopy.isStart(nextCoordinates)
            ? snappingCandidate
            : null,
          draftJunction,
        });
      }
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

      const submitParams = {
        startNode,
        startPipeId: drawing.startPipeId,
        link,
        endNode: endJunction,
      };
      onSubmitLink ? onSubmitLink(submitParams) : submitLink(submitParams);
      resetDrawing();
    },
    exit() {
      const currentDrawing = getDrawingState();

      if (!currentDrawing.isNull) {
        if (sourceLink) {
          setEphemeralState({
            type: "drawLink",
            linkType,
            snappingCandidate: null,
            sourceLink,
          });
        } else {
          resetDrawing();
        }
      } else if (sourceLink) {
        resetDrawing();
        setMode({ mode: Mode.NONE });
      } else {
        resetDrawing();
        setMode({ mode: Mode.NONE });
      }
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
    keydown: () => {
      if (
        isEndAndContinueOn() &&
        !drawing.isNull &&
        !drawing.snappingCandidate
      ) {
        const draftJunction = assetBuilder.buildJunction({
          label: "",
          coordinates: drawing.link.lastVertex,
        });
        setDrawing({
          ...drawing,
          draftJunction,
        });
      }
    },
    keyup: () => {
      if (!isControlHeld() && !drawing.isNull) {
        setDrawing({
          ...drawing,
          draftJunction: undefined,
        });
      }
    },
  };

  return handlers;
}
