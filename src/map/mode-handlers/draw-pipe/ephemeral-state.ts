import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Pipe, NodeAsset } from "src/hydraulics/asset-types";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe: Pipe;
  startNode?: NodeAsset;
  snappingCandidate: NodeAsset | null;
}

export const buildLayers = (state: EphemeralDrawPipe) => {
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
        getRadius: 10,
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
};
