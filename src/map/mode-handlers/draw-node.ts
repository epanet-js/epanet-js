import { USelection } from "src/selection";
import type { HandlerContext } from "src/types";
import {
  modeAtom,
  Mode,
  selectionAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom } from "jotai";
import { CURSOR_DEFAULT } from "src/lib/constants";
import { getMapCoord } from "./utils";
import {
  addJunction,
  addReservoir,
} from "src/hydraulic-model/model-operations";
import throttle from "lodash/throttle";
import { useUserTracking } from "src/infra/user-tracking";
import { useElevations } from "../elevations/use-elevations";

type NodeType = "junction" | "reservoir";

export function useDrawNodeHandlers({
  mode,
  hydraulicModel,
  rep,
  nodeType,
}: HandlerContext & { nodeType: NodeType }): Handlers {
  const setSelection = useSetAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setCursor = useSetAtom(cursorStyleAtom);
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const multi = mode.modeOptions?.multi;
  const { assetBuilder, units } = hydraulicModel;
  const { fetchElevation, prefetchTile } = useElevations(units.elevation);

  return {
    click: async (e) => {
      if (!multi) {
        setMode({ mode: Mode.NONE });
      }

      const clickPosition = getMapCoord(e);
      const elevation = await fetchElevation(e.lngLat);

      let node;
      let moment;

      switch (nodeType) {
        case "junction":
          node = assetBuilder.buildJunction({
            elevation,
            coordinates: clickPosition,
          });
          moment = addJunction(hydraulicModel, { junction: node });
          break;
        case "reservoir":
          node = assetBuilder.buildReservoir({
            elevation,
            coordinates: clickPosition,
          });
          moment = addReservoir(hydraulicModel, { reservoir: node });
          break;
        default:
          throw new Error(`Unsupported node type: ${nodeType as string}`);
      }

      const id = node.id;

      transact(moment);
      userTracking.capture({ name: "asset.created", type: nodeType });
      if (!multi) {
        setSelection(USelection.single(id));
      }
    },
    move: throttle((e) => {
      prefetchTile(e.lngLat);
    }, 200),
    down: noop,
    up() {
      setCursor(CURSOR_DEFAULT);
    },
    double: noop,
    exit() {
      setMode({ mode: Mode.NONE });
    },
  };
}
