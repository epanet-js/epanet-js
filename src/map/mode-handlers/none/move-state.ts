import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { Feature, Position } from "geojson";
import { useAtom } from "jotai";
import { Asset, Reservoir } from "src/hydraulics/asset-types";
import { isFeatureOn } from "src/infra/feature-flags";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
};

import { getIconsSprite, IconId } from "src/map/icons";

type IconData = {
  id: IconId;
  position: Position;
};

export const buildLayers = (state: EphemeralMoveAssets) => {
  if (isFeatureOn("FLAG_RESERVOIR")) {
    const iconsSprite = getIconsSprite();
    const { geojsonFeatures, icons } = state.targetAssets.reduce(
      (acc, asset) => {
        switch (asset.type) {
          case "pipe":
            acc.geojsonFeatures.push(asset.feature);
            break;
          case "junction":
            acc.geojsonFeatures.push(asset.feature);
            break;
          case "reservoir":
            acc.icons.push({
              id: "reservoir",
              position: (asset as Reservoir).coordinates,
            });
            break;
        }
        return acc;
      },
      { geojsonFeatures: [], icons: [] } as {
        geojsonFeatures: Feature[];
        icons: IconData[];
      },
    );

    return [
      new GeoJsonLayer({
        id: "MOVE_TARGET_ASSETS",
        data: geojsonFeatures,
        lineWidthUnits: "pixels",
        pointRadiusUnits: "pixels",
        getLineWidth: 4,
        getFillColor: [0, 0, 0],
        getLineColor: [0, 0, 0],
        getPointRadius: 4,
        lineCapRounded: true,
      }),
      new IconLayer({
        id: "ICONS_OVERLAY",
        data: icons,
        getSize: 20,
        // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
        iconAtlas: iconsSprite.atlas,
        iconMapping: iconsSprite.mapping,
        getIcon: (d) => d.id as string,
      }),
    ];
  } else {
    const targetFeatures = state.targetAssets.map((a) => a.feature);
    const oldFeatures = state.oldAssets.map((a) => a.feature);
    return [
      new GeoJsonLayer({
        id: "MOVE_OLD_ASSETS",
        data: oldFeatures,
        lineWidthUnits: "pixels",
        pointRadiusUnits: "pixels",
        getLineWidth: 5,
        getFillColor: [181, 180, 180],
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
  }
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
