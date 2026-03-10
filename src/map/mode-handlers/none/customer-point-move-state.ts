import { useAtom } from "jotai";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/drawing";
import { Position } from "src/types";

export const useCustomerPointMoveState = () => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const setStartPoint = (
    customerPoint: CustomerPoint,
    startPoint: { x: number; y: number },
  ) => {
    setEphemeralState({
      type: "moveCustomerPoint",
      customerPoint,
      movedCoordinates: customerPoint.coordinates,
      startPoint,
      moveActivated: false,
    });
  };

  const updateMove = (movedCoordinates: Position) => {
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "moveCustomerPoint") return prev;
      return {
        ...prev,
        movedCoordinates,
        moveActivated: true,
      };
    });
  };

  const resetMove = () => {
    setEphemeralState({ type: "none" });
  };

  const isMovingCustomerPoint = state.type === "moveCustomerPoint";
  const moveActivated =
    state.type === "moveCustomerPoint" ? state.moveActivated : false;
  const startPoint =
    state.type === "moveCustomerPoint" ? state.startPoint : undefined;
  const ephemeralState = state.type === "moveCustomerPoint" ? state : null;

  return {
    setStartPoint,
    startPoint,
    updateMove,
    resetMove,
    isMovingCustomerPoint,
    moveActivated,
    ephemeralState,
  };
};
