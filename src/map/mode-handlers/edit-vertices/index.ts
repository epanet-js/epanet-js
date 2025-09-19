import type { HandlerContext } from "src/types";
import {
  Mode,
  ephemeralStateAtom,
  modeAtom,
  cursorStyleAtom,
} from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import { useSelection } from "src/selection";
import { useNoneHandlers } from "../none/none-handlers";

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection, map } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [, setEphemeralState] = useAtom(ephemeralStateAtom);
  const setCursor = useSetAtom(cursorStyleAtom);

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
    move: (e) => {
      const vertexFeatures = map.queryRenderedFeatures(e.point, {
        layers: ["ephemeral-vertices"],
      });

      if (vertexFeatures.length > 0) {
        setCursor("pointer");
      } else {
        defaultHandlers.move(e);
      }
    },
    down: () => {},
    up: () => {},
    exit: exitEditVerticesMode,
  };

  return handlers;
}
