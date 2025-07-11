import { useAtom } from "jotai";
import mapboxgl from "mapbox-gl";
import { Asset } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
  startPoint?: mapboxgl.Point;
};

const nullPoint = new mapboxgl.Point(0, 0);

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
    setEphemeralState((prev: EphemeralEditingState) => {
      if (prev.type !== "moveAssets") {
        return {
          type: "moveAssets",
          startPoint: nullPoint,
          targetAssets,
          oldAssets: targetAssets,
        } as EphemeralMoveAssets;
      }

      return {
        ...prev,
        targetAssets,
        oldAssets: prev.oldAssets.length > 0 ? prev.oldAssets : targetAssets,
      };
    });
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
