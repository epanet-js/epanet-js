import { useAtom } from "jotai";
import { Asset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
  startPoint?: mapboxgl.Point;
};

export const useMoveState = () => {
  const [state, setEphemeralState] = useAtom(ephemeralStateAtom);

  const setStartPoint = (startPoint: mapboxgl.Point) => {
    setEphemeralState({
      type: "moveAssets",
      startPoint,
      oldAssets: [],
      targetAssets: [],
    });
  };

  const startMove = (startAssets: Asset[]) => {
    setEphemeralState({
      type: "moveAssets",
      oldAssets: startAssets,
      targetAssets: startAssets,
    });
  };

  const updateMoveDeprecated = (targetAssets: Asset[]) => {
    if (state.type !== "moveAssets") {
      return startMove(targetAssets);
    }

    setEphemeralState((prev: EphemeralEditingState) => ({
      ...prev,
      targetAssets,
    }));
  };

  const updateMove = (targetAssets: Asset[]) => {
    if (state.type !== "moveAssets")
      throw new Error("Update called without start!");

    setEphemeralState((prev: EphemeralEditingState) =>
      (prev as EphemeralMoveAssets).oldAssets.length > 0
        ? {
            ...prev,
            targetAssets,
          }
        : {
            ...prev,
            targetAssets,
            oldAssets: targetAssets,
          },
    );
  };

  const resetMove = () => {
    setEphemeralState({ type: "none" });
  };

  return {
    setStartPoint,
    startMove,
    startPoint: (state as EphemeralMoveAssets).startPoint,
    updateMove,
    updateMoveDeprecated,
    resetMove,
    isMoving: state.type === "moveAssets",
  };
};
