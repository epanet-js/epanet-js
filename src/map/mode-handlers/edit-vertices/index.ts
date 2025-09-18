import type { HandlerContext } from "src/types";
import { Mode, ephemeralStateAtom, modeAtom } from "src/state/jotai";
import { useSetAtom, useAtom } from "jotai";
import throttle from "lodash/throttle";
import { useSelection } from "src/selection";

export function useEditVerticesHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const { selection } = handlerContext;
  const setMode = useSetAtom(modeAtom);
  const { clearSelection } = useSelection(selection);
  const [, setEphemeralState] = useAtom(ephemeralStateAtom);

  const move = throttle(
    (_e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {},
    16,
  );

  const click = (_e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {};

  const handlers: Handlers = {
    click,
    double: () => {},
    move,
    down: () => {},
    up: () => {},
    exit: () => {
      clearSelection();
      setEphemeralState({ type: "none" });
      setMode({ mode: Mode.NONE });
    },
  };

  return handlers;
}
