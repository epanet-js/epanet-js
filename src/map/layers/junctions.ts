import { CircleLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { asColorExpression, asNumberExpression } from "src/lib/symbolization";
import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { isFeatureOn } from "src/infra/feature-flags";

const indigo200 = "#c7d2fe";
const opacityExpression = (
  symbolization: ISymbolization,
): mapboxgl.Expression => [
  "case",
  ["boolean", ["feature-state", "hidden"], false],
  0,
  asNumberExpression({
    symbolization,
    part: "circle-opacity",
    defaultValue: 1,
  }),
];

export const junctionsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): CircleLayer => {
  if (isFeatureOn("FLAG_MAPBOX_JUNCTIONS")) {
    return {
      id: layerId,
      type: "circle",
      source,
      filter: ["==", ["get", "type"], "junction"],
      paint: {
        "circle-opacity": opacityExpression(symbolization),
        "circle-stroke-color": [
          "match",
          ["feature-state", "selected"],
          "true",
          symbolization.defaultColor,
          symbolization.defaultColor,
        ],
        "circle-stroke-width": 1,
        "circle-stroke-opacity": opacityExpression(symbolization),
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 5],
        "circle-color": [
          "match",
          ["feature-state", "selected"],
          "true",
          LINE_COLORS_SELECTED,
          ["coalesce", ["get", "color"], indigo200],
        ],
      },
      minzoom: 13,
    };
  } else {
    return {
      id: layerId,
      type: "circle",
      source,
      filter: ["==", ["get", "type"], "junction"],
      paint: {
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "hidden"], false],
          0,
          asNumberExpression({
            symbolization,
            part: "circle-opacity",
            defaultValue: 1,
          }),
        ],
        "circle-stroke-color": [
          "match",
          ["feature-state", "selected"],
          "true",
          LINE_COLORS_SELECTED,
          "white",
        ],
        "circle-stroke-width": 0,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 6],
        "circle-color": [
          "match",
          ["feature-state", "selected"],
          "true",
          LINE_COLORS_SELECTED,
          asColorExpression({
            symbolization,
            part: "stroke",
          }),
        ],
      },
    };
  }
};

export const junctionResultsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): CircleLayer => ({
  id: layerId,
  type: "circle",
  source,
  filter: ["==", ["get", "type"], "junction"],
  layout: { visibility: "none" },
  paint: {
    "circle-opacity": opacityExpression(symbolization),
    "circle-stroke-color": symbolization.defaultColor,
    "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 0, 14, 1],
    "circle-stroke-opacity": opacityExpression(symbolization),
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 6],
    "circle-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      ["coalesce", ["get", "color"], indigo200],
    ],
  },
  maxzoom: 14,
});
