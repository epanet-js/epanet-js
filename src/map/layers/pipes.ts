import { LineLayer, LinePaint, SymbolLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { ISymbology } from "src/types";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { isFeatureOn } from "src/infra/feature-flags";

export const pipesLayer = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): LineLayer => {
  const paint = {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
    "line-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      ["coalesce", ["get", "color"], symbology.defaultColor],
    ],
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "closed"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "pipe"],
    paint: paint as LinePaint,
  };
};

export const pipeArrows = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "line-center",
      "icon-image": "triangle",
      "icon-size": isFeatureOn("FLAG_LABELS")
        ? ["interpolate", ["linear"], ["zoom"], 14, 0.2, 26, 0.5]
        : ["interpolate", ["linear"], ["zoom"], 14, 0.2, 20, 0.5],
      "icon-rotate": ["get", "rotation"],
      "icon-ignore-placement": isFeatureOn("FLAG_LABELS") ? true : false,
      "icon-allow-overlap": isFeatureOn("FLAG_LABELS") ? true : false,
      visibility: "none",
    },
    filter: ["all", ["==", "$type", "LineString"], ["==", "hasArrow", true]],
    paint: {
      "icon-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        ["coalesce", ["get", "color"], symbology.defaultColor],
      ],
      "icon-opacity": [
        ...zoomExpression(
          [14, 15, 16, 17, 18, 19, 20],
          [200, 100, 50, 20, 10, 5, 0],
        ),
      ],
    },
    minzoom: 14,
  };
};

const zoomExpression = (
  steps: number[],
  lengths: number[],
): mapboxgl.Expression => {
  const result: mapboxgl.Expression = ["interpolate", ["linear"], ["zoom"]];

  for (const step of steps) {
    const index = steps.indexOf(step);
    const length = lengths[index];
    result.push(step, [
      "case",
      [
        "all",
        [">", ["get", "length"], length],
        ["!", ["boolean", ["feature-state", "hidden"], false]],
      ],
      1,
      0,
    ]);
  }
  return result;
};
