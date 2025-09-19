import type { HandlerContext } from "src/types";
import { Mode, ephemeralStateAtom, modeAtom } from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import { useSelection } from "src/selection";
import { useNoneHandlers } from "../none/none-handlers";

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [, setEphemeralState] = useAtom(ephemeralStateAtom);

  const defaultHandlers = useNoneHandlers(handlerContext);

  const exitEditVerticesMode = () => {
    clearSelection();
    setEphemeralState({ type: "none" });
    setMode({ mode: Mode.NONE });
  };

  const handlers: Handlers = {
    click: (e) => {
      setMode({ mode: Mode.NONE });
      setEphemeralState({ type: "none" });
      defaultHandlers.click(e);
    },
    double: () => {},
    move: defaultHandlers.move,
    down: () => {},
    up: () => {},
    exit: exitEditVerticesMode,
  };

  return handlers;
}
