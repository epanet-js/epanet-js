import type { HandlerContext } from "src/types";
import { Mode, modeAtom } from "src/state/jotai";
import { useSetAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { getMapCoord } from "../utils";
import { useConnectCustomerPointsState } from "./connect-state";
import { usePipeSnapping } from "./pipe-snapping";
import { connectCustomers } from "src/hydraulic-model/model-operations";
import { usePersistence } from "src/lib/persistence/context";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useKeyboardState } from "src/keyboard/use-keyboard-state";

export function useConnectCustomerPointsHandlers({
  hydraulicModel,
  map,
  idMap,
}: HandlerContext): Handlers {
  const mode = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();
  const { isShiftHeld } = useKeyboardState();
  const {
    customerPoints,
    ephemeralState,
    setConnectState,
    setConnectStateWithoutTarget,
    initializeConnectState,
    clearConnectState,
  } = useConnectCustomerPointsState();
  const { findNearestPipe, calculateSnapPoints } = usePipeSnapping(
    map,
    idMap,
    hydraulicModel.assets,
  );

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (
      mode.mode === Mode.CONNECT_CUSTOMER_POINTS &&
      customerPoints.length > 0 &&
      !hasInitializedRef.current
    ) {
      hasInitializedRef.current = true;
      initializeConnectState();
    } else if (mode.mode !== Mode.CONNECT_CUSTOMER_POINTS) {
      hasInitializedRef.current = false;
    }
  }, [mode.mode, customerPoints.length, initializeConnectState]);

  const move = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
    if (customerPoints.length === 0) return;

    const mouseCoord = getMapCoord(e);
    const nearestPipe = findNearestPipe(e.point, mouseCoord);

    if (nearestPipe) {
      const strategy = isShiftHeld() ? "cursor" : "nearest-to-point";
      const snapPoints = calculateSnapPoints(
        customerPoints,
        nearestPipe.pipeId,
        strategy,
        mouseCoord,
      );
      setConnectState({
        customerPoints,
        targetPipeId: nearestPipe.pipeId,
        snapPoints,
        strategy,
      });
    } else {
      setConnectStateWithoutTarget();
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
        strategy: ephemeralState.strategy,
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
