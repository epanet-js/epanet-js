import { useAtom } from "jotai";
import { Asset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
};

export const useMoveState = () => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const startMove = (startAssets: Asset[]) => {
    setEphemeralState({
      type: "moveAssets",
      oldAssets: startAssets,
      targetAssets: startAssets,
    });
  };

  const updateMove = (targetAssets: Asset[]) => {
    if (state.type !== "moveAssets") {
      return startMove(targetAssets);
    }

    setEphemeralState((prev: EphemeralEditingState) => ({
      ...prev,
      targetAssets,
    }));
  };

  const resetMove = () => {
    setEphemeralState({ type: "none" });
  };

  return {
    startMove,
    updateMove,
    resetMove,
    isMoving: state.type === "moveAssets",
  };
};
