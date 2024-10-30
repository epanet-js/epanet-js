import { PathStyleExtension } from "@deck.gl/extensions";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Position } from "geojson";
import { Pipe } from "src/hydraulics/assets";

export interface EphemeralDrawPipe {
  type: "drawPipe";
  pipe: Pipe;
  snappingCandidate: Position | null;
}

export const buildLayers = (state: EphemeralDrawPipe) => {
  return [
    new GeoJsonLayer({
      id: "DRAW_LINE",
      data: [state.pipe.feature],
      lineWidthUnits: "pixels",
      getLineWidth: 4,
      lineCapRounded: true,
      getDashArray: [4, 4],
      extensions: [new PathStyleExtension({ dash: true })],
    }),
    state.snappingCandidate &&
      new ScatterplotLayer({
        id: "SNAPPING_CANDIDATE",
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
