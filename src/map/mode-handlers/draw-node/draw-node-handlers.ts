import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  ephemeralStateAtom,
  cursorStyleAtom,
  selectionAtom,
} from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom, useAtomValue } from "jotai";
import { getMapCoord } from "../utils";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { replaceNode } from "src/hydraulic-model/model-operations/replace-node";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../../elevations/use-elevations";
import { useSnapping } from "../hooks/use-snapping";
import { useSelection } from "src/selection";

type NodeType = "junction" | "reservoir" | "tank";

export function useDrawNodeHandlers({
  hydraulicModel,
  rep,
  nodeType,
  map,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const selection = useAtomValue(selectionAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const { units } = hydraulicModel;
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);
  const { findSnappingCandidate } = useSnapping(map, hydraulicModel.assets);
  const { selectAsset } = useSelection(selection);

  const submitNode = (
    nodeType: NodeType,
    coordinates: [number, number],
    elevation: number,
    pipeIdToSplit?: number,
  ) => {
    const moment = addNode(hydraulicModel, {
      nodeType,
      coordinates,
      elevation,
      pipeIdToSplit,
    });
    transact(moment);
    userTracking.capture({ name: "asset.created", type: nodeType });

    if (moment.putAssets && moment.putAssets.length > 0) {
      const newNodeId = moment.putAssets[0].id;
      selectAsset(newNodeId);
    }
  };

  return {
    click: async (e) => {
      const mouseCoord = getMapCoord(e);
      const snappingCandidate = findSnappingCandidate(e, mouseCoord);

      if (snappingCandidate && snappingCandidate.type !== "pipe") {
        const moment = replaceNode(hydraulicModel, {
          oldNodeId: snappingCandidate.id,
          newNodeType: nodeType,
        });
        transact(moment);
        userTracking.capture({
          name: "asset.created",
          type: nodeType,
        });

        if (moment.putAssets && moment.putAssets.length > 0) {
          const newNodeId = moment.putAssets[0].id;
          selectAsset(newNodeId);
        }

        setEphemeralState({ type: "none" });
        return;
      }

      let clickPosition = getMapCoord(e);
      let elevation = await fetchElevation(e.lngLat);
      let pipeIdToSplit: number | undefined;

      if (
        ephemeralState.type === "drawNode" &&
        ephemeralState.pipeSnappingPosition
      ) {
        clickPosition = ephemeralState.pipeSnappingPosition as [number, number];
        pipeIdToSplit = ephemeralState.pipeId ?? undefined;
        const [lng, lat] = clickPosition;
        elevation = await fetchElevation({ lng, lat } as mapboxgl.LngLat);
      }

      submitNode(nodeType, clickPosition, elevation, pipeIdToSplit);
      setEphemeralState({ type: "none" });
    },
    move: throttle(
      (e) => {
        prefetchTile(e.lngLat);

        const mouseCoord = getMapCoord(e);
        const snappingCandidate = findSnappingCandidate(e, mouseCoord);

        const isNodeSnapping =
          snappingCandidate && snappingCandidate.type !== "pipe";
        const isPipeSnapping =
          snappingCandidate && snappingCandidate.type === "pipe";

        if (isNodeSnapping) {
          setCursor("replace");
        } else {
          setCursor("default");
        }

        setEphemeralState({
          type: "drawNode",
          nodeType,
          pipeSnappingPosition: isPipeSnapping
            ? snappingCandidate.coordinates
            : null,
          pipeId: isPipeSnapping ? snappingCandidate.id : null,
          nodeSnappingId: isNodeSnapping ? snappingCandidate.id : null,
          nodeReplacementId: isNodeSnapping ? snappingCandidate.id : null,
        });
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
