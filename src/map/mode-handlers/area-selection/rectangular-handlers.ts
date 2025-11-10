import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useAreaSelection } from "./use-area-selection";
import { polygonCoordinatesFromPositions } from "src/lib/geometry";

export function useRectangularSelectionHandlers(
  context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const selectContainedAssets = useAreaSelection(context);

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect") return;

      const currentPos = getMapCoord(e);
      setEphemeralState({
        type: "areaSelect",
        selectionMode: Mode.SELECT_RECTANGULAR,
        points: [ephemeralState.points[0], currentPos],
        isValid: true,
      });
      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        const closedPolygon = polygonCoordinatesFromPositions(
          ephemeralState.points[0],
          ephemeralState.points[1],
        )[0];
        selectContainedAssets(closedPolygon);
        setEphemeralState({ type: "none" });
      } else {
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_RECTANGULAR,
          points: [currentPos, currentPos],
          isValid: true,
        });
      }
    },
    exit: () => {
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
      } else {
        setMode({ mode: Mode.NONE });
      }
    },
  };
}
