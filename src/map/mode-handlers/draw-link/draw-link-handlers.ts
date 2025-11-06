import type { HandlerContext, Position } from "src/types";
import type { MapEngine } from "src/map";
import noop from "lodash/noop";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  EphemeralEditingState,
  selectionAtom,
  pipeDrawingDefaultsAtom,
  cursorStyleAtom,
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
import { LngLat, MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import { useSelection } from "src/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { DEFAULT_SNAP_DISTANCE_PIXELS } from "../../search";

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

function isWithinSnappingDistance(
  map: MapEngine,
  position1: Position,
  position2: Position,
): boolean {
  const screen1 = map.map.project([position1[0], position1[1]]);
  const screen2 = map.map.project([position2[0], position2[1]]);

  const pixelDistance = Math.sqrt(
    Math.pow(screen1.x - screen2.x, 2) + Math.pow(screen1.y - screen2.y, 2),
  );

  return pixelDistance < DEFAULT_SNAP_DISTANCE_PIXELS;
}

function getSnappingCandidateIfEnabled(
  event: MapMouseEvent | MapTouchEvent,
  position: Position,
  isSnapping: () => boolean,
  findSnappingCandidate: (
    e: MapMouseEvent | MapTouchEvent,
    pos: Position,
  ) => SnappingCandidate | null,
): SnappingCandidate | null {
  return isSnapping() ? findSnappingCandidate(event, position) : null;
}

type LoopedLinkCheck = {
  isLoopedLink: boolean;
  isHoveringEphemeralStart: boolean;
  shouldPrevent: boolean;
};

function checkLoopedLinkConditions(
  drawing: DrawingState,
  snappingCandidate: SnappingCandidate | null,
  currentPosition: Position,
  map: MapEngine,
): LoopedLinkCheck {
  if (drawing.isNull) {
    return {
      isLoopedLink: false,
      isHoveringEphemeralStart: false,
      shouldPrevent: false,
    };
  }

  const isLoopedLink =
    snappingCandidate !== null &&
    snappingCandidate.type !== "pipe" &&
    snappingCandidate.id === drawing.startNode.id;

  const linkCopy = drawing.link.copy();
  const isHoveringEphemeralStart =
    !snappingCandidate &&
    isWithinSnappingDistance(map, linkCopy.firstVertex, currentPosition) &&
    !linkCopy.isStart(linkCopy.lastVertex);

  return {
    isLoopedLink,
    isHoveringEphemeralStart,
    shouldPrevent: isLoopedLink || isHoveringEphemeralStart,
  };
}

export function useDrawLinkHandlers({
  rep,
  hydraulicModel,
  map,
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
  const { findSnappingCandidate } = useSnapping(map, hydraulicModel.assets);

  const { isShiftHeld, isControlHeld } = useKeyboardState();
  const isPipePropsOn = useFeatureFlag("FLAG_PIPE_PROPS");
  const isLoopedLinksOn = useFeatureFlag("FLAG_LOOPED_LINKS");
  const setCursor = useSetAtom(cursorStyleAtom);
  const pipeDrawingDefaults = useAtomValue(pipeDrawingDefaultsAtom);

  const createLinkForType = (coordinates: Position[] = []) => {
    const startProperties = {
      label: "",
      coordinates,
    };
    switch (linkType) {
      case "pipe":
        if (isPipePropsOn) {
          return assetBuilder.buildPipe({
            ...startProperties,
            ...(pipeDrawingDefaults.diameter && {
              diameter: pipeDrawingDefaults.diameter,
            }),
            ...(pipeDrawingDefaults.roughness && {
              roughness: pipeDrawingDefaults.roughness,
            }),
          });
        }
        return assetBuilder.buildPipe(startProperties);
      case "pump":
        return assetBuilder.buildPump(startProperties);
      case "valve":
        return assetBuilder.buildValve(startProperties);
    }
  };

  const resetDrawing = () => {
    setCursor("default");
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
    setCursor("default");
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

        if (!drawing.isNull && isLoopedLinksOn) {
          const currentPosition = getMapCoord(e);
          const snappingCandidate = getSnappingCandidateIfEnabled(
            e,
            currentPosition,
            isSnapping,
            findSnappingCandidate,
          );
          const check = checkLoopedLinkConditions(
            drawing,
            snappingCandidate,
            currentPosition,
            map,
          );

          if (check.shouldPrevent) {
            return;
          }
        }

        const snappingCandidate = getSnappingCandidateIfEnabled(
          e,
          getMapCoord(e),
          isSnapping,
          findSnappingCandidate,
        );
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

      const snappingCandidate = getSnappingCandidateIfEnabled(
        e,
        getMapCoord(e),
        isSnapping,
        findSnappingCandidate,
      );

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

        if (isLoopedLinksOn) {
          const check = checkLoopedLinkConditions(
            drawing,
            snappingCandidate,
            nextCoordinates,
            map,
          );

          if (check.shouldPrevent) {
            setCursor("not-allowed");
          } else {
            setCursor("default");
          }
        }

        setDrawing({
          ...drawing,
          link: linkCopy,
          snappingCandidate:
            isLoopedLinksOn &&
            checkLoopedLinkConditions(
              drawing,
              snappingCandidate,
              nextCoordinates,
              map,
            ).shouldPrevent
              ? null
              : snappingCandidate,
          draftJunction,
        });
      }
    },
    double: async (e) => {
      e.preventDefault();

      if (drawing.isNull) return;

      if (isLoopedLinksOn) {
        const currentPosition = getMapCoord(e);
        const snappingCandidate = getSnappingCandidateIfEnabled(
          e,
          currentPosition,
          isSnapping,
          findSnappingCandidate,
        );
        const check = checkLoopedLinkConditions(
          drawing,
          snappingCandidate,
          currentPosition,
          map,
        );

        if (check.shouldPrevent) {
          return;
        }
      }

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

      setCursor("default");

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
