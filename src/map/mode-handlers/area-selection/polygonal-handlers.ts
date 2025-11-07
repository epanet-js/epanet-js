import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useAtom, useSetAtom } from "jotai";
import { getMapCoord } from "../utils";

export function usePolygonalSelectionHandlers(
  _context: HandlerContext,
): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);

  return {
    down: noop,
    double: () => {
      setEphemeralState({ type: "none" });
    },
    move: (e) => {
      const currentPos = getMapCoord(e);
      setEphemeralState((prev) => {
        if (prev.type !== "areaSelect") return prev;
        const points = [...prev.points];
        points.pop();
        return {
          type: "areaSelect",
          selectionMode: Mode.SELECT_POLYGONAL,
          points: [...points, currentPos],
        };
      });
      e.preventDefault();
    },
    up: noop,
    click: (e) => {
      const currentPos = getMapCoord(e);
      if (ephemeralState.type === "areaSelect") {
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_POLYGONAL,
          points: [...ephemeralState.points, currentPos],
        });
      } else {
        setEphemeralState({
          type: "areaSelect",
          selectionMode: Mode.SELECT_POLYGONAL,
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
