import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { Feature, Position } from "geojson";
import { useAtom } from "jotai";
import { Asset, Reservoir } from "src/hydraulic-model";
import { EphemeralEditingState, ephemeralStateAtom } from "src/state/jotai";

export type EphemeralMoveAssets = {
  type: "moveAssets";
  oldAssets: Asset[];
  targetAssets: Asset[];
};

import { getIconsSprite, IconId } from "src/map/icons";
import { hexToArray } from "src/lib/color";
import { indigo600 } from "src/lib/constants";

type IconData = {
  id: IconId;
  position: Position;
};

export const buildLayers = (state: EphemeralMoveAssets) => {
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
      id: "ephemeral-move-assets",
      data: geojsonFeatures,
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 4,
      getFillColor: hexToArray(indigo600),
      getLineColor: hexToArray(indigo600),
      getPointRadius: 4,
      lineCapRounded: true,
    }),
    new IconLayer({
      id: "ephemeral-move-icons",
      data: icons,
      getSize: 20,
      // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
      iconAtlas: iconsSprite.atlas,
      iconMapping: iconsSprite.mapping,
      getIcon: (d) => d.id as string,
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
