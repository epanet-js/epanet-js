import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { SymbolLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";

export const pumpIcons = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "line-center",
      "icon-image": "pump",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.2, 20, 0.5],
      "icon-rotate": ["get", "rotation"],
    },
    filter: ["all", ["==", "$type", "LineString"], ["==", "type", "pump"]],
    paint: {
      "icon-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        ["coalesce", ["get", "color"], symbolization.defaultColor],
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
