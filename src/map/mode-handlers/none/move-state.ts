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
    startPoint: (state as EphemeralMoveAssets).startPoint,
    updateMove,
    resetMove,
    isMoving: state.type === "moveAssets",
  };
};
