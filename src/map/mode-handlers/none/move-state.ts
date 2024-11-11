import { GeoJsonLayer } from "@deck.gl/layers";
import { useAtom } from "jotai";
import { Asset } from "src/hydraulics/assets";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
};

export const buildLayers = (state: EphemeralMoveAssets) => {
  const targetFeatures = state.targetAssets.map((a) => a.feature);
  const oldFeatures = state.oldAssets.map((a) => a.feature);
  return [
    new GeoJsonLayer({
      id: "MOVE_OLD_ASSETS",
      data: oldFeatures,
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getFillColor: [180, 180, 180],
      getLineColor: [180, 180, 180],
      getPointRadius: 4,
      lineCapRounded: true,
    }),
    new GeoJsonLayer({
      id: "MOVE_TARGET_ASSETS",
      data: targetFeatures,
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 4,
      getFillColor: [0, 0, 0],
      getLineColor: [0, 0, 0],
      getPointRadius: 4,
      lineCapRounded: true,
    }),
  ];
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
