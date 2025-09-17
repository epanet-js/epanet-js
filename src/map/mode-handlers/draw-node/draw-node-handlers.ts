import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom } from "jotai";
import { getMapCoord } from "../utils";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../../elevations/use-elevations";
import { useSnapping } from "../hooks/use-snapping";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type NodeType = "junction" | "reservoir" | "tank";

export function useDrawNodeHandlers({
  hydraulicModel,
  rep,
  nodeType,
  map,
  idMap,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const { units } = hydraulicModel;
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);
  const isSnappingOn = useFeatureFlag("FLAG_SNAPPING");
  const { findSnappingCandidate } = useSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const submitNode = (
    nodeType: NodeType,
    coordinates: [number, number],
    elevation: number,
    pipeIdToSplit?: string,
  ) => {
    const moment = addNode(hydraulicModel, {
      nodeType,
      coordinates,
      elevation,
      pipeIdToSplit,
    });
    transact(moment);
    userTracking.capture({ name: "asset.created", type: nodeType });
  };

  return {
    click: async (e) => {
      if (isSnappingOn) {
        const mouseCoord = getMapCoord(e);
        const snappingCandidate = findSnappingCandidate(e, mouseCoord);

        if (snappingCandidate && snappingCandidate.type !== "pipe") {
          return;
        }
      }

      let clickPosition = getMapCoord(e);
      let elevation = await fetchElevation(e.lngLat);
      let pipeIdToSplit: string | undefined;

      if (
        isSnappingOn &&
        ephemeralState.type === "drawNode" &&
        ephemeralState.pipeSnappingPosition
      ) {
        clickPosition = ephemeralState.pipeSnappingPosition as [number, number];
        pipeIdToSplit = ephemeralState.pipeId || undefined;
        const [lng, lat] = clickPosition;
        elevation = await fetchElevation({ lng, lat } as mapboxgl.LngLat);
      }

      submitNode(nodeType, clickPosition, elevation, pipeIdToSplit);
      setEphemeralState({ type: "none" });
    },
    move: throttle(
      (e) => {
        prefetchTile(e.lngLat);

        if (isSnappingOn) {
          const mouseCoord = getMapCoord(e);
          const snappingCandidate = findSnappingCandidate(e, mouseCoord);

          const isNodeSnapping =
            snappingCandidate && snappingCandidate.type !== "pipe";
          const isPipeSnapping =
            snappingCandidate && snappingCandidate.type === "pipe";

          setCursor(isNodeSnapping ? "not-allowed" : "default");

          setEphemeralState({
            type: "drawNode",
            nodeType,
            pipeSnappingPosition: isPipeSnapping
              ? snappingCandidate.coordinates
              : null,
            pipeId: isPipeSnapping ? snappingCandidate.id : null,
            nodeSnappingId: isNodeSnapping ? snappingCandidate.id : null,
          });
        }
      },
      200,
      { trailing: false },
    ),
    down: noop,
    up: noop,
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
      setEphemeralState({ type: "none" });
      setCursor("default");
    },
  };
}
