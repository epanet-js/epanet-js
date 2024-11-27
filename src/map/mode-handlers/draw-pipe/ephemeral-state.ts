import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer, IconLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Position } from "geojson";
import { Pipe, NodeAsset, Reservoir } from "src/hydraulics/asset-types";
import { isFeatureOn } from "src/infra/feature-flags";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe: Pipe;
  startNode?: NodeAsset;
  snappingCandidate: NodeAsset | null;
}

import { fetchImageAsTexture } from "src/map/icons/fetch-image-as-texture";
import reservoirOutlinedPng from "src/map/icons/reservoir-outlined.png";

const iconMapping = {
  "reservoir-outlined": { x: 0, y: 0, width: 32, height: 32 },
};
const iconAtlas = {
  data: fetchImageAsTexture(reservoirOutlinedPng.src),
  mapping: iconMapping,
};
type IconData = {
  id: string;
  position: Position;
};

export const buildLayers = (state: EphemeralDrawPipe) => {
  if (isFeatureOn("FLAG_RESERVOIR")) {
    const geojsonFeatures = [];
    const icons: IconData[] = [];
    if (state.startNode) {
      switch (state.startNode.type) {
        case "junction":
          geojsonFeatures.push(state.startNode.feature);
          break;
        case "reservoir":
          icons.push({
            id: "reservoir-outlined",
            position: (state.startNode as Reservoir).coordinates,
          });
          break;
        case "pipe":
          break;
      }
    }
    if (state.pipe) geojsonFeatures.push(state.pipe.feature);
    if (state.snappingCandidate) {
      switch (state.snappingCandidate.type) {
        case "junction":
          geojsonFeatures.push(state.snappingCandidate.feature);
          break;
        case "reservoir":
          icons.push({
            id: "reservoir-outlined",
            position: (state.snappingCandidate as Reservoir).coordinates,
          });
          break;
        case "pipe":
          break;
      }
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
        iconAtlas: iconAtlas.data,
        iconMapping: iconAtlas.mapping,
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
