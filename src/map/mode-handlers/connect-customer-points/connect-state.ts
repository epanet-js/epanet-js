import { useAtom, useAtomValue } from "jotai";
import {
  ephemeralStateAtom,
  selectionAtom,
  dataAtom,
  EphemeralConnectCustomerPoints,
} from "src/state/jotai";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Position } from "src/types";

export const useConnectCustomerPointsState = () => {
  const [ephemeralState, setEphemeralState] = useAtom(ephemeralStateAtom);
  const selection = useAtomValue(selectionAtom);
  const data = useAtomValue(dataAtom);

  const customerPoints: CustomerPoint[] = (() => {
    if (selection.type === "singleCustomerPoint") {
      const customerPoint = data.hydraulicModel.customerPoints.get(
        selection.id,
      );
      return customerPoint ? [customerPoint] : [];
    }
    return [];
  })();

  const setConnectState = (state: {
    customerPoints: CustomerPoint[];
    targetPipeId: string;
    snapPoints: Position[];
    strategy: "nearest-to-point" | "cursor";
  }) => {
    const newState: EphemeralConnectCustomerPoints = {
      type: "connectCustomerPoints",
      ...state,
    };
    setEphemeralState(newState);
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
    clearConnectState,
  };
};
