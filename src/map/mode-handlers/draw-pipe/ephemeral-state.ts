import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer, IconLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Feature, Position } from "geojson";
import { Pipe, NodeAsset } from "src/hydraulics/asset-types";
import { captureWarning } from "src/infra/error-tracking";
import { isFeatureOn } from "src/infra/feature-flags";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe: Pipe;
  startNode?: NodeAsset;
  snappingCandidate: NodeAsset | null;
}

import { IconId, getIconsSprite } from "src/map/icons";

type IconData = {
  id: IconId;
  position: Position;
};

const appendNode = (
  geojsonFeatures: Feature[],
  icons: IconData[],
  node: NodeAsset,
) => {
  switch (node.type) {
    case "junction":
      geojsonFeatures.push(node.feature);
      break;
    case "reservoir":
      icons.push({
        id: "reservoir-outlined",
        position: node.coordinates,
      });
      break;
    default:
      captureWarning(
        `Method missing to append ephemeral state for node ${node.type}`,
      );
  }
};

export const buildLayers = (state: EphemeralDrawPipe) => {
  if (isFeatureOn("FLAG_RESERVOIR")) {
    const iconsSprite = getIconsSprite();
    const geojsonFeatures: Feature[] = [];
    const icons: IconData[] = [];
    if (state.startNode) {
      appendNode(geojsonFeatures, icons, state.startNode);
    }
    if (state.pipe) geojsonFeatures.push(state.pipe.feature);
    if (state.snappingCandidate) {
      appendNode(geojsonFeatures, icons, state.snappingCandidate);
    }

    return [
      state.snappingCandidate &&
        new ScatterplotLayer({
          id: "DRAW_PIPE_SNAPPING_CANDIDATE",
          data: [state.snappingCandidate.coordinates],
          getPosition: <T>(d: T) => d,
          getRadius: isFeatureOn("FLAG_RESERVOIR") ? 14 : 10,
          radiusUnits: "pixels",
          stroked: true,
          getFillColor: [255, 140, 0, 100],
          getLineColor: [0, 0, 0],
          getLineWidth: 0,
          lineWidthUnits: "pixels",
        }),
      new GeoJsonLayer({
        id: "DRAW_PIPE_GEOJSON",
        data: geojsonFeatures,
        lineWidthUnits: "pixels",
        pointRadiusUnits: "pixels",
        getLineWidth: 4,
        getFillColor: [255, 255, 255],
        getPointRadius: 4,
        lineCapRounded: true,
        getDashArray: [3, 3],
        extensions: [new PathStyleExtension({ dash: true })],
      }),
      new IconLayer({
        id: "ICONS_OVERLAY",
        data: icons,
        getSize: 16,
        // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
        iconAtlas: iconsSprite.atlas,
        iconMapping: iconsSprite.mapping,
        getIcon: (d) => d.id as string,
      }),
    ];
  } else {
    const geojsonFeatures = [];
    if (state.startNode) geojsonFeatures.push(state.startNode.feature);
    if (state.pipe) geojsonFeatures.push(state.pipe.feature);
    if (state.snappingCandidate) {
      geojsonFeatures.push(state.snappingCandidate.feature);
    }

    return [
      state.snappingCandidate &&
        new ScatterplotLayer({
          id: "DRAW_PIPE_SNAPPING_CANDIDATE",
          data: [state.snappingCandidate.coordinates],
          getPosition: <T>(d: T) => d,
          getRadius:
            isFeatureOn("FLAG_RESERVOIR") &&
            state.snappingCandidate.type === "reservoir"
              ? 14
              : 10,
          radiusUnits: "pixels",
          stroked: true,
          getFillColor: [255, 140, 0, 100],
          getLineColor: [0, 0, 0],
          getLineWidth: 1,
          lineWidthUnits: "pixels",
        }),
      new GeoJsonLayer({
        id: "DRAW_PIPE_GEOJSON",
        data: geojsonFeatures,
        lineWidthUnits: "pixels",
        pointRadiusUnits: "pixels",
        getLineWidth: 4,
        getFillColor: [255, 255, 255],
        getPointRadius: 4,
        lineCapRounded: true,
        getDashArray: [3, 3],
        extensions: [new PathStyleExtension({ dash: true })],
      }),
    ];
  }
};
