import type { HandlerContext } from "src/types";
import { Mode, modeAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { getMapCoord } from "../utils";
import { useConnectCustomerPointsState } from "./connect-state";
import { usePipeSnapping } from "./pipe-snapping";
import { connectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence/context";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";

export function useConnectCustomerPointsHandlers({
  hydraulicModel,
  map,
  idMap,
}: HandlerContext): Handlers {
  const setMode = useSetAtom(modeAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const { customerPoints, ephemeralState, setConnectState, clearConnectState } =
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

  const click = (_e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    if (
      !ephemeralState ||
      !ephemeralState.targetPipeId ||
      ephemeralState.customerPoints.length === 0
    ) {
      return;
    }

    try {
      const moment = connectCustomers(hydraulicModel, {
        customerPointIds: ephemeralState.customerPoints.map((cp) => cp.id),
        pipeId: ephemeralState.targetPipeId,
        snapPoints: ephemeralState.snapPoints,
      });

      userTracking.capture({
        name: "customerPoints.connected",
        count: ephemeralState.customerPoints.length,
      });

      transact(moment);
      setMode({ mode: Mode.NONE });
      clearConnectState();
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error("Failed to connect customer points"),
      );
      setMode({ mode: Mode.NONE });
      clearConnectState();
    }
  };

  const exit = () => {
    setMode({ mode: Mode.NONE });
    clearConnectState();
  };

  return {
    click,
    move,
    down: () => {},
    up: () => {},
    double: () => {},
    exit,
  };
}
