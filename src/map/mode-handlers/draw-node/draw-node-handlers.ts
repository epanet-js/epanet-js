import type { HandlerContext } from "src/types";
import { modeAtom, Mode } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../../elevations/use-elevations";
import { NodeAsset } from "src/hydraulic-model";

type NodeType = "junction" | "reservoir" | "tank";

export function useDrawNodeHandlers({
  hydraulicModel,
  rep,
  nodeType,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const setMode = useSetAtom(modeAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const { assetBuilder, units } = hydraulicModel;
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);

  const submitNode = (node: NodeAsset) => {
    const moment = addNode(hydraulicModel, { node });
    transact(moment);
    userTracking.capture({ name: "asset.created", type: nodeType });
  };

  return {
    click: async (e) => {
      const clickPosition = getMapCoord(e);
      const elevation = await fetchElevation(e.lngLat);

      let node;

      switch (nodeType) {
        case "junction":
          node = assetBuilder.buildJunction({
            elevation,
            coordinates: clickPosition,
          });
          break;
        case "reservoir":
          node = assetBuilder.buildReservoir({
            elevation,
            coordinates: clickPosition,
          });
          break;
        case "tank":
          node = assetBuilder.buildTank({
            elevation,
            coordinates: clickPosition,
          });
          break;
        default:
          throw new Error(`Unsupported node type: ${nodeType as string}`);
      }

      submitNode(node);
    },
    move: throttle((e) => {
      prefetchTile(e.lngLat);
    }, 200),
    down: noop,
    up: noop,
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
    },
  };
}
