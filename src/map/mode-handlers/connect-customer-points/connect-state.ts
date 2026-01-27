import { useAtom, useAtomValue } from "jotai";
import {
  ephemeralStateAtom,
  selectionAtom,
  stagingModelAtom,
  EphemeralConnectCustomerPoints,
} from "src/state/jotai";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Position } from "src/types";
import { useMemo } from "react";

export const useConnectCustomerPointsState = () => {
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);

  const customerPoints = useMemo(() => {
    if (selection.type === "singleCustomerPoint") {
      const customerPoint = hydraulicModel.customerPoints.get(selection.id);
      return customerPoint ? [customerPoint] : [];
    }
    return [];
  }, [hydraulicModel.customerPoints, selection]);

  const setConnectState = (state: {
    customerPoints: CustomerPoint[];
    targetPipeId?: number;
    snapPoints: Position[];
    strategy: "nearest-to-point" | "cursor";
  }) => {
    const newState: EphemeralConnectCustomerPoints = {
      type: "connectCustomerPoints",
      ...state,
    };
    setEphemeralState(newState);
  };

  const setConnectStateWithoutTarget = () => {
    const newState: EphemeralConnectCustomerPoints = {
      type: "connectCustomerPoints",
      customerPoints,
      snapPoints: [],
      strategy: "nearest-to-point",
    };
    setEphemeralState(newState);
  };

  const initializeConnectState = () => {
    setConnectStateWithoutTarget();
  };

  const clearConnectState = () => {
    if (ephemeralState.type === "connectCustomerPoints") {
      setEphemeralState({ type: "none" });
    }
  };

  return {
    customerPoints,
    ephemeralState:
      ephemeralState.type === "connectCustomerPoints" ? ephemeralState : null,
    setConnectState,
    setConnectStateWithoutTarget,
    initializeConnectState,
    clearConnectState,
  };
};
