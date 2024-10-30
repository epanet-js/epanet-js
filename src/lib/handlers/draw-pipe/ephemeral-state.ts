import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Position } from "geojson";
import { NodeAsset, Pipe } from "src/hydraulics/assets";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe?: Pipe;
  startNode?: NodeAsset;
  snappingCandidate: Position | null;
}

export const buildLayers = (state: EphemeralDrawPipe) => {
  const geojsonFeatures = [];
  if (state.startNode) geojsonFeatures.push(state.startNode.feature);
  if (state.pipe) geojsonFeatures.push(state.pipe.feature);

  return [
    new GeoJsonLayer({
      id: "DRAW_PIPE_GEOJSON",
      data: geojsonFeatures,
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 4,
      getFillColor: [255, 255, 255],
      getPointRadius: 4,
      lineCapRounded: true,
      getDashArray: [4, 4],
      extensions: [new PathStyleExtension({ dash: true })],
    }),
    state.snappingCandidate &&
      new ScatterplotLayer({
        id: "DRAW_PIPE_SNAPPING_CANDIDATE",
        data: [state.snappingCandidate],
        getPosition: (d) => d,
        getRadius: 10,
        radiusUnits: "pixels",
        stroked: true,
        getFillColor: [255, 140, 0, 100],
        getLineColor: [0, 0, 0],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
      }),
  ];
};
