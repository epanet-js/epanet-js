import type { HandlerContext } from "src/types";
import { modeAtom, Mode, ephemeralStateAtom } from "src/state/jotai";
import noop from "lodash/noop";
import { useSetAtom, useAtom } from "jotai";
import { getMapCoord } from "../utils";

export function useLassoHandlers(_context: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);

  return {
    down: noop,
    double: noop,
    move: (e) => {
      if (ephemeralState.type !== "lasso") return;

      const currentPos = getMapCoord(e);
      setEphemeralState({
        type: "lasso",
        points: [...ephemeralState.points, currentPos],
      });
      e.preventDefault();
    },
    up: () => {
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    },
    click: () => {
      setMode({ mode: Mode.NONE });
    },
    exit: () => {
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    },
  };
}
