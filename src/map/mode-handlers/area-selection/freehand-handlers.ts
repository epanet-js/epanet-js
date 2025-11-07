import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom } from "jotai";
import { getMapCoord } from "../utils";

export function useFreehandSelectionHandlers(
  _context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "areaSelect") return;

      const currentPos = getMapCoord(e);
      setEphemeralState({
        type: "areaSelect",
        selectionMode: Mode.SELECT_FREEHAND,
        points: [...ephemeralState.points, currentPos],
      });
      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({ type: "none" });
      } else {
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_FREEHAND,
          points: [currentPos, currentPos],
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
