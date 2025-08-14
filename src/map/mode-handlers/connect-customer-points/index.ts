import type { HandlerContext } from "src/types";
import { Mode, modeAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useConnectCustomerPointsState } from "./connect-state";
import { usePipeSnapping } from "./pipe-snapping";

export function useConnectCustomerPointsHandlers({
  hydraulicModel,
  map,
  idMap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const { customerPoints, setConnectState, clearConnectState } =
    useConnectCustomerPointsState();
  const { findNearestPipe, calculateSnapPoints } = usePipeSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const move = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    if (customerPoints.length === 0) return;

    const mouseCoord = getMapCoord(e);
    const nearestPipe = findNearestPipe(e.point, mouseCoord);

    if (nearestPipe) {
      const snapPoints = calculateSnapPoints(
        customerPoints,
        nearestPipe.pipeId,
      );
      setConnectState({
        customerPoints,
        targetPipeId: nearestPipe.pipeId,
        snapPoints,
      });
    } else {
      clearConnectState();
    }
  };

  const exit = () => {
    setMode({ mode: Mode.NONE });
    clearConnectState();
  };

  return {
    click: () => {},
    move,
    down: () => {},
    up: () => {},
    double: () => {},
    exit,
  };
}
